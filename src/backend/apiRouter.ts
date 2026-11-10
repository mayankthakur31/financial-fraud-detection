/**
 * Express REST API Router
 * Endpoints for Transactions, Alerts, Analyst Reviews, ML Insights, Analytics, Network, and Simulator
 */

import { Router, Request, Response } from 'express';
import { db } from './db.ts';
import { processIncomingTransaction } from './ingestService.ts';
import { simulator } from './simulator.ts';
import { analyzeAccountNetwork } from './networkGraph.ts';
import { runAutomatedTests } from './testRunner.ts';

export const apiRouter = Router();

// 1. Health & Readiness
apiRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
    const modelRow = db.prepare('SELECT version, algorithm FROM model_metadata LIMIT 1').get() as any;

    res.json({
      status: 'UP',
      uptimeSec: Math.floor(process.uptime()),
      database: {
        status: 'CONNECTED',
        driver: 'node:sqlite (Relational Engine)',
        transactionCount: row.count
      },
      model: {
        status: 'LOADED',
        version: modelRow?.version || 'v1.4-xgb-calibrated',
        algorithm: modelRow?.algorithm || 'XGBoost + Calibrated Logistic Regression'
      },
      timestamp: Date.now()
    });
  } catch (err: any) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

// 2. Ingest Single Transaction
apiRouter.post('/transactions', (req: Request, res: Response) => {
  try {
    const result = processIncomingTransaction(req.body, false);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({
      error: 'Transaction Ingestion Failed',
      message: err.message
    });
  }
});

// 3. Ingest Batch Transactions (Bounded to max 100)
apiRouter.post('/transactions/batch', (req: Request, res: Response) => {
  try {
    const items = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Batch payload must be a JSON array of transactions' });
      return;
    }

    if (items.length > 100) {
      res.status(400).json({ error: 'Batch size exceeds maximum limit of 100 transactions per request' });
      return;
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const itemResult = processIncomingTransaction(items[i], false);
        results.push(itemResult);
      } catch (e: any) {
        errors.push({ index: i, error: e.message });
      }
    }

    res.status(200).json({
      total: items.length,
      processed: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Batch processing failed', message: err.message });
  }
});

// 4. Paginated Transactions Search & Filtering
apiRouter.get('/transactions', (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const search = (req.query.search as string || '').trim();
    const type = (req.query.type as string || '').trim();
    const risk = (req.query.risk as string || '').trim();
    const status = (req.query.status as string || '').trim();
    const minAmount = parseFloat(req.query.min_amount as string);
    const maxAmount = parseFloat(req.query.max_amount as string);
    const sortField = ['timestamp', 'amount', 'fraud_probability'].includes(req.query.sort_by as string) ? req.query.sort_by : 'timestamp';
    const sortOrder = (req.query.sort_order as string || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      conditions.push('(t.id LIKE ? OR t.name_orig LIKE ? OR t.name_dest LIKE ?)');
      const wild = `%${search}%`;
      params.push(wild, wild, wild);
    }

    if (type && type !== 'ALL') {
      conditions.push('t.type = ?');
      params.push(type);
    }

    if (risk && risk !== 'ALL') {
      conditions.push('p.risk_category = ?');
      params.push(risk);
    }

    if (status && status !== 'ALL') {
      if (status === 'ALERT_OPEN') {
        conditions.push("a.status IN ('PENDING', 'UNDER_REVIEW')");
      } else if (status === 'RESOLVED') {
        conditions.push("a.status IN ('RESOLVED_LEGITIMATE', 'RESOLVED_FRAUD', 'ESCALATED')");
      } else if (status === 'NO_ALERT') {
        conditions.push('a.id IS NULL');
      } else {
        conditions.push('a.status = ?');
        params.push(status);
      }
    }

    if (!isNaN(minAmount)) {
      conditions.push('t.amount >= ?');
      params.push(minAmount);
    }

    if (!isNaN(maxAmount)) {
      conditions.push('t.amount <= ?');
      params.push(maxAmount);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM transactions t
      LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
      LEFT JOIN alerts a ON t.id = a.transaction_id
      ${whereClause}
    `;
    const countRow = db.prepare(countSql).get(...params) as { total: number };
    const total = countRow.total;

    // Fetch page
    const sortColumn = sortField === 'fraud_probability' ? 'p.fraud_probability' : `t.${sortField}`;
    const dataSql = `
      SELECT 
        t.id, t.step, t.type, t.amount, t.name_orig, t.old_balance_orig, t.new_balance_orig,
        t.name_dest, t.old_balance_dest, t.new_balance_dest, t.timestamp, t.is_synthetic,
        p.fraud_probability, p.risk_category, p.model_version, p.inference_latency_ms,
        a.id as alert_id, a.status as alert_status, a.severity as alert_severity, a.rule_triggers
      FROM transactions t
      LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
      LEFT JOIN alerts a ON t.id = a.transaction_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataSql).all(...params, limit, offset) as any[];

    const transactions = rows.map(r => ({
      id: r.id,
      step: r.step,
      type: r.type,
      amount: r.amount,
      nameOrig: r.name_orig,
      oldbalanceOrg: r.old_balance_orig,
      newbalanceOrig: r.new_balance_orig,
      nameDest: r.name_dest,
      oldbalanceDest: r.old_balance_dest,
      newbalanceDest: r.new_balance_dest,
      timestamp: r.timestamp,
      isSynthetic: r.is_synthetic === 1,
      prediction: {
        probability: r.fraud_probability,
        riskCategory: r.risk_category,
        modelVersion: r.model_version,
        latencyMs: r.inference_latency_ms
      },
      alert: r.alert_id ? {
        id: r.alert_id,
        status: r.alert_status,
        severity: r.alert_severity,
        triggers: r.rule_triggers ? JSON.parse(r.rule_triggers) : []
      } : null
    }));

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      transactions
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to query transactions', message: err.message });
  }
});

// 5. Individual Transaction Deep Dive
apiRouter.get('/transactions/:id', (req: Request, res: Response) => {
  try {
    const txId = req.params.id;
    const txSql = `
      SELECT 
        t.*,
        p.fraud_probability, p.risk_category, p.model_version, p.feature_attributions, p.inference_latency_ms,
        a.id as alert_id, a.status as alert_status, a.severity as alert_severity, a.rule_triggers, a.created_at as alert_created_at
      FROM transactions t
      LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
      LEFT JOIN alerts a ON t.id = a.transaction_id
      WHERE t.id = ?
    `;
    const tx = db.prepare(txSql).get(txId) as any;
    if (!tx) {
      res.status(404).json({ error: `Transaction '${txId}' not found` });
      return;
    }

    // Fetch review history if any
    const reviews = db.prepare(`
      SELECT * FROM analyst_reviews WHERE transaction_id = ? ORDER BY created_at DESC
    `).all(txId) as any[];

    // Fetch counterparty transactions
    const counterpartyTxs = db.prepare(`
      SELECT t.id, t.type, t.amount, t.timestamp, p.risk_category, p.fraud_probability
      FROM transactions t
      LEFT JOIN fraud_predictions p ON t.id = p.transaction_id
      WHERE (t.name_orig = ? OR t.name_dest = ?) AND t.id != ?
      ORDER BY t.timestamp DESC
      LIMIT 5
    `).all(tx.name_orig, tx.name_dest, txId) as any[];

    res.json({
      id: tx.id,
      step: tx.step,
      type: tx.type,
      amount: tx.amount,
      nameOrig: tx.name_orig,
      oldbalanceOrg: tx.old_balance_orig,
      newbalanceOrig: tx.new_balance_orig,
      nameDest: tx.name_dest,
      oldbalanceDest: tx.old_balance_dest,
      newbalanceDest: tx.new_balance_dest,
      timestamp: tx.timestamp,
      isSynthetic: tx.is_synthetic === 1,
      prediction: {
        probability: tx.fraud_probability,
        riskCategory: tx.risk_category,
        modelVersion: tx.model_version,
        latencyMs: tx.inference_latency_ms,
        attributions: tx.feature_attributions ? JSON.parse(tx.feature_attributions) : []
      },
      alert: tx.alert_id ? {
        id: tx.alert_id,
        status: tx.alert_status,
        severity: tx.alert_severity,
        triggers: tx.rule_triggers ? JSON.parse(tx.rule_triggers) : [],
        createdAt: tx.alert_created_at
      } : null,
      reviews,
      counterpartyHistory: counterpartyTxs
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch transaction details', message: err.message });
  }
});

// 6. Alerts List with Triage Filters
apiRouter.get('/alerts', (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string || 'ALL').trim();
    const severity = (req.query.severity as string || 'ALL').trim();

    const conditions: string[] = [];
    const params: any[] = [];

    if (status !== 'ALL') {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (severity !== 'ALL') {
      conditions.push('a.severity = ?');
      params.push(severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        a.id as alert_id, a.severity, a.status, a.rule_triggers, a.created_at, a.updated_at,
        t.id as transaction_id, t.type, t.amount, t.name_orig, t.name_dest, t.timestamp,
        p.fraud_probability, p.risk_category
      FROM alerts a
      JOIN transactions t ON a.transaction_id = t.id
      JOIN fraud_predictions p ON t.id = p.transaction_id
      ${whereClause}
      ORDER BY 
        CASE a.status 
          WHEN 'PENDING' THEN 1 
          WHEN 'UNDER_REVIEW' THEN 2 
          ELSE 3 
        END,
        p.fraud_probability DESC,
        a.created_at DESC
      LIMIT 100
    `;

    const rows = db.prepare(sql).all(...params) as any[];

    const alerts = rows.map(r => ({
      id: r.alert_id,
      transactionId: r.transaction_id,
      severity: r.severity,
      status: r.status,
      triggers: r.rule_triggers ? JSON.parse(r.rule_triggers) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      transaction: {
        id: r.transaction_id,
        type: r.type,
        amount: r.amount,
        nameOrig: r.name_orig,
        nameDest: r.name_dest,
        timestamp: r.timestamp
      },
      prediction: {
        probability: r.fraud_probability,
        riskCategory: r.risk_category
      }
    }));

    res.json({ count: alerts.length, alerts });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch alerts', message: err.message });
  }
});

// 7. Update Alert Status
apiRouter.patch('/alerts/:id', (req: Request, res: Response) => {
  try {
    const alertId = req.params.id;
    const { status } = req.body;
    const allowed = ['PENDING', 'UNDER_REVIEW', 'RESOLVED_LEGITIMATE', 'RESOLVED_FRAUD', 'ESCALATED'];

    if (!allowed.includes(status)) {
      res.status(400).json({ error: `Invalid status '${status}'. Must be one of: ${allowed.join(', ')}` });
      return;
    }

    const check = db.prepare('SELECT id FROM alerts WHERE id = ?').get(alertId);
    if (!check) {
      res.status(404).json({ error: `Alert '${alertId}' not found` });
      return;
    }

    db.prepare('UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), alertId);

    res.json({ success: true, alertId, status });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update alert', message: err.message });
  }
});

// 8. Submit Analyst Review Decision
apiRouter.post('/reviews', (req: Request, res: Response) => {
  try {
    const { alertId, transactionId, analystId, decision, notes } = req.body;

    if (!alertId || !transactionId || !decision) {
      res.status(400).json({ error: 'alertId, transactionId, and decision are required' });
      return;
    }

    const validDecisions = ['CONFIRMED_FRAUD', 'LEGITIMATE', 'ESCALATED'];
    if (!validDecisions.includes(decision)) {
      res.status(400).json({ error: `Invalid decision '${decision}'. Must be: ${validDecisions.join(', ')}` });
      return;
    }

    const reviewId = `rev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = Date.now();

    db.exec('BEGIN TRANSACTION;');

    // 1. Insert review
    db.prepare(`
      INSERT INTO analyst_reviews (id, alert_id, transaction_id, analyst_id, decision, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      alertId,
      transactionId,
      analystId || 'analyst_current',
      decision,
      notes || 'No review notes provided',
      now
    );

    // 2. Map decision to alert status
    const statusMap: Record<string, string> = {
      CONFIRMED_FRAUD: 'RESOLVED_FRAUD',
      LEGITIMATE: 'RESOLVED_LEGITIMATE',
      ESCALATED: 'ESCALATED'
    };
    const newStatus = statusMap[decision];

    db.prepare('UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, alertId);

    // 3. Audit trail log
    db.prepare(`
      INSERT INTO audit_events (id, action, entity_type, entity_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `aud_${now}`,
      'RECORD_ANALYST_REVIEW',
      'ALERT',
      alertId,
      JSON.stringify({ transactionId, decision, analystId }),
      now
    );

    db.exec('COMMIT;');

    res.status(201).json({
      success: true,
      reviewId,
      alertId,
      decision,
      newStatus,
      timestamp: now
    });
  } catch (err: any) {
    try { db.exec('ROLLBACK;'); } catch {}
    res.status(500).json({ error: 'Failed to record analyst review', message: err.message });
  }
});

// 9. Account Network Graph Analysis
apiRouter.get('/network', (req: Request, res: Response) => {
  try {
    const accountId = req.query.account_id as string;
    const result = analyzeAccountNetwork(accountId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Network analysis failed', message: err.message });
  }
});

apiRouter.get('/network/:accountId', (req: Request, res: Response) => {
  try {
    const accountId = req.params.accountId;
    const result = analyzeAccountNetwork(accountId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Network analysis failed', message: err.message });
  }
});

// 10. Dashboard Analytics Summary
apiRouter.get('/analytics/summary', (_req: Request, res: Response) => {
  try {
    const totalTx = (db.prepare('SELECT COUNT(*) as count FROM transactions').get() as any).count;
    const totalVolume = (db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM transactions').get() as any).total;
    const highRiskCount = (db.prepare("SELECT COUNT(*) as count FROM fraud_predictions WHERE risk_category = 'HIGH'").get() as any).count;
    const mediumRiskCount = (db.prepare("SELECT COUNT(*) as count FROM fraud_predictions WHERE risk_category = 'MEDIUM'").get() as any).count;
    const lowRiskCount = (db.prepare("SELECT COUNT(*) as count FROM fraud_predictions WHERE risk_category = 'LOW'").get() as any).count;

    const totalAlerts = (db.prepare('SELECT COUNT(*) as count FROM alerts').get() as any).count;
    const pendingAlerts = (db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('PENDING', 'UNDER_REVIEW')").get() as any).count;
    const confirmedFraudCount = (db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'RESOLVED_FRAUD'").get() as any).count;
    const legitimateCount = (db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'RESOLVED_LEGITIMATE'").get() as any).count;

    const avgLatency = (db.prepare('SELECT AVG(inference_latency_ms) as avg_lat FROM fraud_predictions').get() as any).avg_lat || 4.2;

    // Fraud rates:
    // Predicted high risk rate vs confirmed fraud rate
    const predictedRiskRate = totalTx > 0 ? (highRiskCount / totalTx) * 100 : 0;
    const confirmedFraudRate = totalTx > 0 ? (confirmedFraudCount / totalTx) * 100 : 0;

    res.json({
      totalTransactions: totalTx,
      totalVolume: Math.round(totalVolume),
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      totalAlerts,
      unresolvedAlerts: pendingAlerts,
      confirmedFraudCount,
      confirmedLegitimateCount: legitimateCount,
      predictedRiskRate: parseFloat(predictedRiskRate.toFixed(2)),
      confirmedFraudRate: parseFloat(confirmedFraudRate.toFixed(2)),
      averageInferenceLatencyMs: parseFloat(avgLatency.toFixed(2))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate analytics summary', message: err.message });
  }
});

// 11. Transaction Volume & Risk Trends (Time series)
apiRouter.get('/analytics/trends', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT 
        step,
        COUNT(*) as count,
        SUM(amount) as volume,
        SUM(CASE WHEN p.risk_category = 'HIGH' THEN 1 ELSE 0 END) as high_risk,
        SUM(CASE WHEN p.risk_category = 'MEDIUM' THEN 1 ELSE 0 END) as medium_risk,
        SUM(CASE WHEN p.risk_category = 'LOW' THEN 1 ELSE 0 END) as low_risk
      FROM transactions t
      JOIN fraud_predictions p ON t.id = p.transaction_id
      GROUP BY step
      ORDER BY step ASC
      LIMIT 30
    `).all() as any[];

    const trends = rows.map(r => ({
      step: `Step ${r.step}`,
      stepNumber: r.step,
      totalCount: r.count,
      totalVolume: Math.round(r.volume),
      highRisk: r.high_risk,
      mediumRisk: r.medium_risk,
      lowRisk: r.low_risk
    }));

    res.json({ trends });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate trends', message: err.message });
  }
});

// 12. Model Metadata & Evaluation Results
apiRouter.get('/model-insights', (_req: Request, res: Response) => {
  try {
    const model = db.prepare('SELECT * FROM model_metadata LIMIT 1').get() as any;
    if (!model) {
      res.status(404).json({ error: 'No trained model metadata available' });
      return;
    }

    res.json({
      version: model.version,
      algorithm: model.algorithm,
      trainedAt: model.trained_at,
      metrics: {
        precision: model.precision,
        recall: model.recall,
        f1Score: model.f1_score,
        prAuc: model.pr_auc,
        rocAuc: model.roc_auc
      },
      confusionMatrix: JSON.parse(model.confusion_matrix),
      featureImportance: JSON.parse(model.feature_importance),
      trainingDataset: {
        name: 'PaySim Synthetic Financial Datasets',
        samples: 6362620,
        fraudPrevalence: '0.129% (8,213 fraudulent transactions out of 6,362,620)',
        classImbalanceRatio: '1 : 773',
        handlingTechnique: 'Scale Pos Weight (XGBoost) + Threshold Tuning on Precision-Recall Curve'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch model insights', message: err.message });
  }
});

// 13. Simulator Controls
apiRouter.get('/simulator/status', (_req: Request, res: Response) => {
  res.json(simulator.getStatus());
});

apiRouter.post('/simulator/start', (req: Request, res: Response) => {
  const rate = parseFloat(req.body.ratePerSec) || 1;
  const scenario = req.body.scenario || 'MIXED_LIVE';
  const status = simulator.start(rate, scenario);
  res.json({ success: true, status });
});

apiRouter.post('/simulator/stop', (_req: Request, res: Response) => {
  const status = simulator.stop();
  res.json({ success: true, status });
});

apiRouter.post('/simulator/tick', (_req: Request, res: Response) => {
  const result = simulator.tick();
  res.json({ success: !!result, result, status: simulator.getStatus() });
});

// 14. Execute Automated In-App Verification Suite
apiRouter.post('/tests/run', (_req: Request, res: Response) => {
  try {
    const summary = runAutomatedTests();
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: 'Test execution encountered an error', message: err.message });
  }
});
