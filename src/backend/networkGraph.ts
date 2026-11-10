/**
 * Suspicious Account Network & Counterparty Graph Analyzer
 * Analyzes transaction chains, shared counterparties, fan-in/fan-out patterns, and money-mule hops.
 */

import { db } from './db.ts';

export interface GraphNode {
  id: string;
  type: 'ORIGINATOR' | 'BENEFICIARY' | 'MERCHANT' | 'INTERMEDIARY';
  isFlagged: boolean;
  totalVolume: number;
  txCount: number;
  riskScore: number;
  patternLabel?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  type: string;
  timestamp: number;
  riskCategory: string;
  isFlagged: boolean;
}

export interface NetworkGraphResult {
  rootAccountId?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  suspiciousPatterns: {
    patternType: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    involvedAccounts: string[];
    evidence: string;
  }[];
}

export function analyzeAccountNetwork(targetAccountId?: string): NetworkGraphResult {
  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  let query = `
    SELECT 
      t.id, t.type, t.amount, t.name_orig, t.name_dest, t.timestamp,
      p.fraud_probability, p.risk_category,
      a.id as alert_id, a.status as alert_status
    FROM transactions t
    LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
    LEFT JOIN alerts a ON t.id = a.transaction_id
  `;

  let params: any[] = [];
  if (targetAccountId) {
    query += ` WHERE t.name_orig = ? OR t.name_dest = ? `;
    params = [targetAccountId, targetAccountId];
  } else {
    query += ` ORDER BY t.timestamp DESC LIMIT 100 `;
  }

  const stmt = db.prepare(query);
  const rows = (targetAccountId ? stmt.all(targetAccountId, targetAccountId) : stmt.all()) as any[];

  // Also if targetAccountId provided, get 2nd hop transactions for counterparties
  let allRows = [...rows];
  if (targetAccountId && rows.length > 0) {
    const counterparties = new Set<string>();
    rows.forEach(r => {
      if (r.name_orig !== targetAccountId) counterparties.add(r.name_orig);
      if (r.name_dest !== targetAccountId) counterparties.add(r.name_dest);
    });

    const cpList = Array.from(counterparties).slice(0, 10);
    if (cpList.length > 0) {
      const placeholders = cpList.map(() => '?').join(',');
      const hopStmt = db.prepare(`
        SELECT 
          t.id, t.type, t.amount, t.name_orig, t.name_dest, t.timestamp,
          p.fraud_probability, p.risk_category,
          a.id as alert_id, a.status as alert_status
        FROM transactions t
        LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
        LEFT JOIN alerts a ON t.id = a.transaction_id
        WHERE t.name_orig IN (${placeholders}) OR t.name_dest IN (${placeholders})
        LIMIT 60
      `);
      const hopRows = hopStmt.all(...cpList, ...cpList) as any[];
      // Deduplicate
      const seenIds = new Set(allRows.map(r => r.id));
      hopRows.forEach(hr => {
        if (!seenIds.has(hr.id)) {
          allRows.push(hr);
          seenIds.add(hr.id);
        }
      });
    }
  }

  // Populate edges & nodes
  allRows.forEach(r => {
    const isAlert = !!r.alert_id;
    const isHigh = r.risk_category === 'HIGH' || (r.fraud_probability || 0) >= 0.70;

    edges.push({
      id: r.id,
      source: r.name_orig,
      target: r.name_dest,
      amount: r.amount,
      type: r.type,
      timestamp: r.timestamp,
      riskCategory: r.risk_category || 'LOW',
      isFlagged: isAlert || isHigh
    });

    // Sender node
    if (!nodesMap.has(r.name_orig)) {
      nodesMap.set(r.name_orig, {
        id: r.name_orig,
        type: r.name_orig.startsWith('M') ? 'MERCHANT' : 'ORIGINATOR',
        isFlagged: false,
        totalVolume: 0,
        txCount: 0,
        riskScore: 0
      });
    }
    const origNode = nodesMap.get(r.name_orig)!;
    origNode.totalVolume += r.amount;
    origNode.txCount += 1;
    origNode.riskScore = Math.max(origNode.riskScore, r.fraud_probability || 0);
    if (isAlert || isHigh) origNode.isFlagged = true;

    // Dest node
    if (!nodesMap.has(r.name_dest)) {
      nodesMap.set(r.name_dest, {
        id: r.name_dest,
        type: r.name_dest.startsWith('M') ? 'MERCHANT' : 'BENEFICIARY',
        isFlagged: false,
        totalVolume: 0,
        txCount: 0,
        riskScore: 0
      });
    }
    const destNode = nodesMap.get(r.name_dest)!;
    destNode.totalVolume += r.amount;
    destNode.txCount += 1;
    destNode.riskScore = Math.max(destNode.riskScore, r.fraud_probability || 0);
    if (isAlert || isHigh) destNode.isFlagged = true;
  });

  // Detect suspicious topological patterns
  const patterns: NetworkGraphResult['suspiciousPatterns'] = [];

  // 1. Pass-through money mule / intermediary detection
  nodesMap.forEach(node => {
    const inTxs = edges.filter(e => e.target === node.id);
    const outTxs = edges.filter(e => e.source === node.id);

    if (inTxs.length > 0 && outTxs.length > 0) {
      node.type = 'INTERMEDIARY';
      const inVol = inTxs.reduce((s, e) => s + e.amount, 0);
      const outVol = outTxs.reduce((s, e) => s + e.amount, 0);

      // Check for rapid pass-through or drain
      if (Math.abs(inVol - outVol) / Math.max(inVol, outVol) < 0.15 && node.riskScore > 0.5) {
        node.patternLabel = 'Pass-Through Mule';
        patterns.push({
          patternType: 'Pass-Through Laundering Node',
          description: `Account ${node.id} received $${inVol.toLocaleString()} and immediately transmitted $${outVol.toLocaleString()} to downstream counterparties.`,
          severity: 'HIGH',
          involvedAccounts: [node.id, ...inTxs.map(t => t.source), ...outTxs.map(t => t.target)],
          evidence: `Inbound volume: $${inVol.toFixed(2)} (${inTxs.length} txs), Outbound volume: $${outVol.toFixed(2)} (${outTxs.length} txs). Minimal balance retention.`
        });
      }
    }

    // 2. Fan-in destination aggregator
    if (inTxs.length >= 3 && outTxs.length === 0) {
      const uniqueSenders = new Set(inTxs.map(e => e.source));
      if (uniqueSenders.size >= 3) {
        node.patternLabel = 'Aggregation Sink';
        patterns.push({
          patternType: 'Fan-In Fund Concentration',
          description: `Account ${node.id} functions as a collector node aggregating funds from ${uniqueSenders.size} separate source accounts.`,
          severity: 'MEDIUM',
          involvedAccounts: [node.id, ...Array.from(uniqueSenders)],
          evidence: `Aggregated $${inTxs.reduce((s, e) => s + e.amount, 0).toLocaleString()} across ${inTxs.length} incoming transactions.`
        });
      }
    }

    // 3. High-risk counterparty
    if (node.riskScore >= 0.85 && !node.patternLabel) {
      node.patternLabel = 'High-Risk Origin';
    }
  });

  return {
    rootAccountId: targetAccountId,
    nodes: Array.from(nodesMap.values()),
    edges,
    suspiciousPatterns: patterns
  };
}
