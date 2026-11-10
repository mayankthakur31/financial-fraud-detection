/**
 * Database module using Node.js built-in node:sqlite
 * Implements relational schema with constraints, indexes, and seed transactions
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'fraud_detection.db');
export const db = new DatabaseSync(DB_PATH);

// Initialize relational tables
export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      step INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN')),
      amount REAL NOT NULL CHECK(amount >= 0),
      name_orig TEXT NOT NULL,
      old_balance_orig REAL NOT NULL,
      new_balance_orig REAL NOT NULL,
      name_dest TEXT NOT NULL,
      old_balance_dest REAL NOT NULL,
      new_balance_dest REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      is_synthetic INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_name_orig ON transactions(name_orig);
    CREATE INDEX IF NOT EXISTS idx_transactions_name_dest ON transactions(name_dest);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

    CREATE TABLE IF NOT EXISTS fraud_predictions (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL UNIQUE,
      fraud_probability REAL NOT NULL,
      risk_category TEXT NOT NULL CHECK(risk_category IN ('LOW', 'MEDIUM', 'HIGH')),
      model_version TEXT NOT NULL,
      feature_attributions TEXT NOT NULL, -- JSON
      inference_latency_ms REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fraud_predictions_risk ON fraud_predictions(risk_category);
    CREATE INDEX IF NOT EXISTS idx_fraud_predictions_prob ON fraud_predictions(fraud_probability);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL UNIQUE,
      severity TEXT NOT NULL CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH')),
      status TEXT NOT NULL CHECK(status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED_LEGITIMATE', 'RESOLVED_FRAUD', 'ESCALATED')),
      rule_triggers TEXT NOT NULL, -- JSON array of triggered risk indicators
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

    CREATE TABLE IF NOT EXISTS analyst_reviews (
      id TEXT PRIMARY KEY,
      alert_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      analyst_id TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('CONFIRMED_FRAUD', 'LEGITIMATE', 'ESCALATED')),
      notes TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT, -- JSON
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_metadata (
      version TEXT PRIMARY KEY,
      algorithm TEXT NOT NULL,
      trained_at INTEGER NOT NULL,
      precision REAL NOT NULL,
      recall REAL NOT NULL,
      f1_score REAL NOT NULL,
      pr_auc REAL NOT NULL,
      roc_auc REAL NOT NULL,
      confusion_matrix TEXT NOT NULL, -- JSON
      feature_importance TEXT NOT NULL -- JSON
    );
  `);

  // Insert model metadata if empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM model_metadata');
  const countRow = countStmt.get() as { count: number };
  if (countRow.count === 0) {
    const insertModel = db.prepare(`
      INSERT INTO model_metadata (
        version, algorithm, trained_at, precision, recall, f1_score, pr_auc, roc_auc, confusion_matrix, feature_importance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertModel.run(
      'v1.4-xgb-calibrated',
      'Gradient Boosted Decision Trees (XGBoost) + Calibrated Logistic Regression',
      Date.now() - 86400000 * 3,
      0.942, // Precision
      0.887, // Recall
      0.914, // F1-score
      0.923, // PR-AUC
      0.994, // ROC-AUC
      JSON.stringify({
        true_negative: 127204,
        false_positive: 78,
        false_negative: 142,
        true_positive: 1116
      }),
      JSON.stringify([
        { feature: 'error_balance_orig', importance: 0.342, description: 'Discrepancy in sender remaining balance after transfer' },
        { feature: 'is_transfer_or_cashout', importance: 0.231, description: 'Transaction type is TRANSFER or CASH_OUT (PaySim hallmark)' },
        { feature: 'error_balance_dest', importance: 0.174, description: 'Discrepancy in beneficiary account incoming balance' },
        { feature: 'amount_to_old_balance_ratio', importance: 0.118, description: 'Ratio of transaction amount to sender initial balance' },
        { feature: 'log_amount', importance: 0.065, description: 'Normalized transaction magnitude' },
        { feature: 'account_velocity_count', importance: 0.042, description: 'Rapid sequential transactions from same originator' },
        { feature: 'dest_zero_balance_flag', importance: 0.028, description: 'Destination balance remains 0 after funds movement' }
      ])
    );
  }

  // Seed baseline PaySim transactions if empty
  const txCountStmt = db.prepare('SELECT COUNT(*) as count FROM transactions');
  const txCount = (txCountStmt.get() as { count: number }).count;
  if (txCount === 0) {
    seedInitialTransactions();
  }
}

function seedInitialTransactions() {
  const insertTx = db.prepare(`
    INSERT INTO transactions (
      id, step, type, amount, name_orig, old_balance_orig, new_balance_orig,
      name_dest, old_balance_dest, new_balance_dest, timestamp, is_synthetic
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPred = db.prepare(`
    INSERT INTO fraud_predictions (
      id, transaction_id, fraud_probability, risk_category, model_version,
      feature_attributions, inference_latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = db.prepare(`
    INSERT INTO alerts (
      id, transaction_id, severity, status, rule_triggers, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const baseTime = Date.now() - 3600000 * 24; // 24 hours ago

  const seedData = [
    // 1. High-risk: Full account drain via TRANSFER followed by zero destination balance
    {
      id: 'tx_ps_9041281',
      step: 142,
      type: 'TRANSFER',
      amount: 450000.00,
      name_orig: 'C192847102',
      old_balance_orig: 450000.00,
      new_balance_orig: 0.00,
      name_dest: 'C883920194',
      old_balance_dest: 0.00,
      new_balance_dest: 0.00,
      prob: 0.965,
      risk: 'HIGH',
      triggers: ['Complete Originator Account Drain (100%)', 'Zero Destination Balance Post-Transfer', 'PaySim High-Risk Transfer Vector'],
      alertStatus: 'PENDING'
    },
    // 2. High-risk: Sudden rapid CASH_OUT of newly received funds
    {
      id: 'tx_ps_9041282',
      step: 142,
      type: 'CASH_OUT',
      amount: 450000.00,
      name_orig: 'C883920194',
      old_balance_orig: 450000.00,
      new_balance_orig: 0.00,
      name_dest: 'M992817263',
      old_balance_dest: 0.00,
      new_balance_dest: 450000.00,
      prob: 0.941,
      risk: 'HIGH',
      triggers: ['Immediate Rapid Cash-Out', 'High Velocity Drain', 'Counterparty linked to tx_ps_9041281'],
      alertStatus: 'UNDER_REVIEW'
    },
    // 3. Medium-risk: Unusual amount TRANSFER exceeding typical baseline
    {
      id: 'tx_ps_8827361',
      step: 143,
      type: 'TRANSFER',
      amount: 88500.00,
      name_orig: 'C554928172',
      old_balance_orig: 120000.00,
      new_balance_orig: 31500.00,
      name_dest: 'C102938475',
      old_balance_dest: 5000.00,
      new_balance_dest: 93500.00,
      prob: 0.485,
      risk: 'MEDIUM',
      triggers: ['High transfer-to-balance ratio (73.7%)', 'Unusual time-of-step spike'],
      alertStatus: 'PENDING'
    },
    // 4. Legitimate normal PAYMENT
    {
      id: 'tx_ps_7718293',
      step: 143,
      type: 'PAYMENT',
      amount: 142.50,
      name_orig: 'C118273645',
      old_balance_orig: 3200.00,
      new_balance_orig: 3057.50,
      name_dest: 'M182736451',
      old_balance_dest: 0.00,
      new_balance_dest: 0.00,
      prob: 0.012,
      risk: 'LOW',
      triggers: [],
      alertStatus: null
    },
    // 5. Normal CASH_IN
    {
      id: 'tx_ps_7718294',
      step: 144,
      type: 'CASH_IN',
      amount: 2500.00,
      name_orig: 'C992817264',
      old_balance_orig: 1500.00,
      new_balance_orig: 4000.00,
      name_dest: 'C881726354',
      old_balance_dest: 15400.00,
      new_balance_dest: 12900.00,
      prob: 0.005,
      risk: 'LOW',
      triggers: [],
      alertStatus: null
    },
    // 6. Legitimate salary DEBIT
    {
      id: 'tx_ps_7718295',
      step: 144,
      type: 'DEBIT',
      amount: 450.00,
      name_orig: 'C443829102',
      old_balance_orig: 8900.00,
      new_balance_orig: 8450.00,
      name_dest: 'M291827364',
      old_balance_dest: 0.00,
      new_balance_dest: 0.00,
      prob: 0.008,
      risk: 'LOW',
      triggers: [],
      alertStatus: null
    },
    // 7. High-risk: Smurfing structuring attempt (repeated transfers just below typical $10,000 threshold)
    {
      id: 'tx_ps_9041283',
      step: 145,
      type: 'TRANSFER',
      amount: 9850.00,
      name_orig: 'C773829104',
      old_balance_orig: 30000.00,
      new_balance_orig: 20150.00,
      name_dest: 'C338291048',
      old_balance_dest: 120.00,
      new_balance_dest: 9970.00,
      prob: 0.732,
      risk: 'HIGH',
      triggers: ['Potential Structuring / Smurfing Pattern', 'Velocity Alert: 3rd transfer within 2 hours'],
      alertStatus: 'PENDING'
    },
    // 8. Legitimate normal TRANSFER between established personal accounts
    {
      id: 'tx_ps_7718296',
      step: 145,
      type: 'TRANSFER',
      amount: 1200.00,
      name_orig: 'C551928374',
      old_balance_orig: 25000.00,
      new_balance_orig: 23800.00,
      name_dest: 'C994827163',
      old_balance_dest: 1500.00,
      new_balance_dest: 2700.00,
      prob: 0.034,
      risk: 'LOW',
      triggers: [],
      alertStatus: null
    },
    // 9. High-risk: Flagged fraudulent transfer investigated & confirmed
    {
      id: 'tx_ps_9041280',
      step: 140,
      type: 'TRANSFER',
      amount: 820000.00,
      name_orig: 'C662718293',
      old_balance_orig: 820000.00,
      new_balance_orig: 0.00,
      name_dest: 'C992817265',
      old_balance_dest: 0.00,
      new_balance_dest: 0.00,
      prob: 0.988,
      risk: 'HIGH',
      triggers: ['Total Balance Exfiltration ($820k)', 'Zero Receiver Final Balance', 'Account Takeover Profile'],
      alertStatus: 'RESOLVED_FRAUD'
    },
    // 10. Medium-risk alert reviewed and marked legitimate
    {
      id: 'tx_ps_8827360',
      step: 139,
      type: 'CASH_OUT',
      amount: 32000.00,
      name_orig: 'C119283746',
      old_balance_orig: 35000.00,
      new_balance_orig: 3000.00,
      name_dest: 'M882736452',
      old_balance_dest: 20000.00,
      new_balance_dest: 52000.00,
      prob: 0.521,
      risk: 'MEDIUM',
      triggers: ['Substantial cash-out ratio', 'Commercial vendor destination'],
      alertStatus: 'RESOLVED_LEGITIMATE'
    }
  ];

  for (let i = 0; i < seedData.length; i++) {
    const item = seedData[i];
    const txTime = baseTime + i * 3600000;

    insertTx.run(
      item.id,
      item.step,
      item.type,
      item.amount,
      item.name_orig,
      item.old_balance_orig,
      item.new_balance_orig,
      item.name_dest,
      item.old_balance_dest,
      item.new_balance_dest,
      txTime,
      0
    );

    const attributions = [
      { feature: 'type', value: item.type, contribution: item.type === 'TRANSFER' || item.type === 'CASH_OUT' ? 0.28 : -0.25 },
      { feature: 'amount', value: item.amount, contribution: item.amount > 50000 ? 0.32 : -0.15 },
      { feature: 'orig_drain', value: item.old_balance_orig > 0 ? (item.amount / item.old_balance_orig).toFixed(2) : '0', contribution: item.new_balance_orig === 0 ? 0.35 : -0.1 }
    ];

    insertPred.run(
      `pred_${item.id}`,
      item.id,
      item.prob,
      item.risk,
      'v1.4-xgb-calibrated',
      JSON.stringify(attributions),
      Math.round(4 + Math.random() * 8),
      txTime
    );

    if (item.alertStatus) {
      const alertId = `alt_${item.id}`;
      insertAlert.run(
        alertId,
        item.id,
        item.risk,
        item.alertStatus,
        JSON.stringify(item.triggers),
        txTime,
        txTime
      );

      // If resolved, add an analyst review record
      if (item.alertStatus === 'RESOLVED_FRAUD') {
        const insertRev = db.prepare(`
          INSERT INTO analyst_reviews (id, alert_id, transaction_id, analyst_id, decision, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertRev.run(
          `rev_${item.id}`,
          alertId,
          item.id,
          'analyst_sarah_m',
          'CONFIRMED_FRAUD',
          'Confirmed account takeover. Victim reported credentials compromised in phishing incident. Funds frozen at destination node.',
          txTime + 1800000
        );
      } else if (item.alertStatus === 'RESOLVED_LEGITIMATE') {
        const insertRev = db.prepare(`
          INSERT INTO analyst_reviews (id, alert_id, transaction_id, analyst_id, decision, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertRev.run(
          `rev_${item.id}`,
          alertId,
          item.id,
          'analyst_james_k',
          'LEGITIMATE',
          'Customer verified commercial purchase of construction machinery via two-factor phone callback. Transaction unflagged.',
          txTime + 2400000
        );
      }
    }
  }
}
