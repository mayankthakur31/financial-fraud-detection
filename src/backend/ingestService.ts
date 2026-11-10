/**
 * Core Transaction Ingestion Service
 * Handles validation, feature preprocessing, prediction scoring, relational persistence, and alert generation.
 */

import { db } from './db.ts';
import { RawTransactionInput, predictFraudRisk, PredictionResult } from './mlEngine.ts';

export interface TransactionIngestResponse {
  transactionId: string;
  fraudProbability: number;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  alertGenerated: boolean;
  alertId?: string;
  ruleTriggers: string[];
  modelVersion: string;
  inferenceLatencyMs: number;
  totalLatencyMs: number;
  timestamp: number;
  attributions: PredictionResult['attributions'];
}

export function validateTransactionInput(body: any): RawTransactionInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Transaction body must be a JSON object');
  }

  const validTypes = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'DEBIT', 'CASH_IN'];
  if (!validTypes.includes(body.type)) {
    throw new Error(`Invalid transaction type '${body.type}'. Must be one of: ${validTypes.join(', ')}`);
  }

  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount < 0) {
    throw new Error('Transaction amount must be a positive number');
  }

  if (!body.nameOrig || typeof body.nameOrig !== 'string' || body.nameOrig.trim() === '') {
    throw new Error('Originator account identifier (nameOrig) is required');
  }

  if (!body.nameDest || typeof body.nameDest !== 'string' || body.nameDest.trim() === '') {
    throw new Error('Beneficiary account identifier (nameDest) is required');
  }

  const oldbalanceOrg = parseFloat(body.oldbalanceOrg ?? body.old_balance_orig ?? 0);
  const newbalanceOrig = parseFloat(body.newbalanceOrig ?? body.new_balance_orig ?? 0);
  const oldbalanceDest = parseFloat(body.oldbalanceDest ?? body.old_balance_dest ?? 0);
  const newbalanceDest = parseFloat(body.newbalanceDest ?? body.new_balance_dest ?? 0);

  if (isNaN(oldbalanceOrg) || oldbalanceOrg < 0) throw new Error('oldbalanceOrg must be non-negative');
  if (isNaN(newbalanceOrig) || newbalanceOrig < 0) throw new Error('newbalanceOrig must be non-negative');
  if (isNaN(oldbalanceDest) || oldbalanceDest < 0) throw new Error('oldbalanceDest must be non-negative');
  if (isNaN(newbalanceDest) || newbalanceDest < 0) throw new Error('newbalanceDest must be non-negative');

  const step = parseInt(body.step ?? 1);

  return {
    step: isNaN(step) ? 1 : step,
    type: body.type,
    amount,
    nameOrig: body.nameOrig.trim(),
    oldbalanceOrg,
    newbalanceOrig,
    nameDest: body.nameDest.trim(),
    oldbalanceDest,
    newbalanceDest,
    timestamp: body.timestamp || Date.now()
  };
}

export function processIncomingTransaction(
  rawInput: any,
  isSynthetic: boolean = false,
  customTxId?: string
): TransactionIngestResponse {
  const startProcessing = performance.now();
  const tx = validateTransactionInput(rawInput);
  const txId = customTxId || (rawInput.id ? String(rawInput.id) : `tx_live_${Date.now()}_${Math.floor(Math.random() * 10000)}`);

  // Duplicate check
  const checkStmt = db.prepare('SELECT id FROM transactions WHERE id = ?');
  const existing = checkStmt.get(txId);
  if (existing) {
    throw new Error(`Transaction with ID '${txId}' has already been processed.`);
  }

  // Predict fraud risk using calibrated ML engine
  const prediction = predictFraudRisk(tx);

  // Relational persistence in single database transaction
  const timestamp = tx.timestamp || Date.now();

  try {
    db.exec('BEGIN TRANSACTION;');

    // 1. Insert transaction record
    const insertTx = db.prepare(`
      INSERT INTO transactions (
        id, step, type, amount, name_orig, old_balance_orig, new_balance_orig,
        name_dest, old_balance_dest, new_balance_dest, timestamp, is_synthetic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTx.run(
      txId,
      tx.step || 1,
      tx.type,
      tx.amount,
      tx.nameOrig,
      tx.oldbalanceOrg,
      tx.newbalanceOrig,
      tx.nameDest,
      tx.oldbalanceDest,
      tx.newbalanceDest,
      timestamp,
      isSynthetic ? 1 : 0
    );

    // 2. Insert fraud prediction record
    const predId = `pred_${txId}`;
    const insertPred = db.prepare(`
      INSERT INTO fraud_predictions (
        id, transaction_id, fraud_probability, risk_category, model_version,
        feature_attributions, inference_latency_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertPred.run(
      predId,
      txId,
      prediction.fraudProbability,
      prediction.riskCategory,
      prediction.modelVersion,
      JSON.stringify(prediction.attributions),
      prediction.inferenceLatencyMs,
      timestamp
    );

    // 3. Conditional Alert generation for Medium / High risk
    let alertId: string | undefined = undefined;
    const shouldAlert = prediction.riskCategory === 'HIGH' || prediction.riskCategory === 'MEDIUM';

    if (shouldAlert) {
      alertId = `alt_${txId}`;
      const insertAlert = db.prepare(`
        INSERT INTO alerts (
          id, transaction_id, severity, status, rule_triggers, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertAlert.run(
        alertId,
        txId,
        prediction.riskCategory,
        'PENDING',
        JSON.stringify(prediction.ruleTriggers),
        timestamp,
        timestamp
      );
    }

    // 4. Audit event log
    const auditStmt = db.prepare(`
      INSERT INTO audit_events (id, action, entity_type, entity_id, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    auditStmt.run(
      `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      'INGEST_TRANSACTION',
      'TRANSACTION',
      txId,
      JSON.stringify({
        risk: prediction.riskCategory,
        probability: prediction.fraudProbability,
        alertGenerated: shouldAlert
      }),
      timestamp
    );

    db.exec('COMMIT;');

    const totalLatency = parseFloat((performance.now() - startProcessing).toFixed(2));

    return {
      transactionId: txId,
      fraudProbability: prediction.fraudProbability,
      riskCategory: prediction.riskCategory,
      alertGenerated: shouldAlert,
      alertId,
      ruleTriggers: prediction.ruleTriggers,
      modelVersion: prediction.modelVersion,
      inferenceLatencyMs: prediction.inferenceLatencyMs,
      totalLatencyMs: totalLatency,
      timestamp,
      attributions: prediction.attributions
    };
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw error;
  }
}
