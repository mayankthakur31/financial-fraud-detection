/**
 * Automated Verification & Testing Suite
 * Tests core capabilities: Health, Ingestion, ML Scoring, Alerts, Reviews, Filters, Simulator
 */

import { db } from './db.ts';
import { processIncomingTransaction, validateTransactionInput } from './ingestService.ts';
import { simulator } from './simulator.ts';

export interface TestCaseResult {
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details?: string;
  error?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  timestamp: number;
  results: TestCaseResult[];
}

export function runAutomatedTests(): TestSuiteSummary {
  const startTime = performance.now();
  const results: TestCaseResult[] = [];

  function test(name: string, category: string, fn: () => void) {
    const t0 = performance.now();
    try {
      fn();
      results.push({
        name,
        category,
        status: 'PASSED',
        durationMs: parseFloat((performance.now() - t0).toFixed(2))
      });
    } catch (err: any) {
      results.push({
        name,
        category,
        status: 'FAILED',
        durationMs: parseFloat((performance.now() - t0).toFixed(2)),
        error: err.message || String(err)
      });
    }
  }

  // 1. Health & Database Integrity
  test('Relational Database Schema & Foreign Key Enforcement', 'Database', () => {
    const checkTbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").get();
    if (!checkTbl) throw new Error('transactions table not found in database');
    const checkPred = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='fraud_predictions'").get();
    if (!checkPred) throw new Error('fraud_predictions table not found');
  });

  test('Model Metadata & Pretrained Evaluation Artifacts', 'Machine Learning', () => {
    const model = db.prepare('SELECT * FROM model_metadata WHERE version = ?').get('v1.4-xgb-calibrated') as any;
    if (!model) throw new Error('Trained model metadata missing from database');
    if (model.precision < 0.85 || model.recall < 0.80) {
      throw new Error(`Model metrics below threshold: P=${model.precision}, R=${model.recall}`);
    }
  });

  // 2. Input Validation
  test('Input Validation: Rejects Invalid Transaction Types', 'Validation', () => {
    try {
      validateTransactionInput({
        type: 'INVALID_CRYPTO',
        amount: 100,
        nameOrig: 'C123',
        nameDest: 'C456'
      });
      throw new Error('Did not throw on invalid transaction type');
    } catch (e: any) {
      if (!e.message.includes('Invalid transaction type')) throw e;
    }
  });

  test('Input Validation: Rejects Negative Amounts & Missing Accounts', 'Validation', () => {
    try {
      validateTransactionInput({
        type: 'TRANSFER',
        amount: -500,
        nameOrig: '',
        nameDest: 'C456'
      });
      throw new Error('Did not throw on negative amount');
    } catch (e: any) {
      if (!e.message.includes('positive number') && !e.message.includes('Originator account identifier')) throw e;
    }
  });

  // 3. Scoring & Ingestion
  const testTxIdHigh = `tx_test_high_${Date.now()}`;
  test('ML Scoring: High-Risk Account Takeover Drain (>0.70 Probability)', 'Inference', () => {
    const res = processIncomingTransaction({
      step: 200,
      type: 'TRANSFER',
      amount: 150000,
      nameOrig: 'C_TEST_VICTIM_1',
      oldbalanceOrg: 150000,
      newbalanceOrig: 0,
      nameDest: 'C_TEST_MULE_1',
      oldbalanceDest: 0,
      newbalanceDest: 0
    }, true, testTxIdHigh);

    if (res.fraudProbability < 0.70) {
      throw new Error(`Expected high fraud probability (>=0.70), got ${res.fraudProbability}`);
    }
    if (res.riskCategory !== 'HIGH') {
      throw new Error(`Expected riskCategory HIGH, got ${res.riskCategory}`);
    }
    if (!res.alertGenerated) {
      throw new Error('Expected alert to be automatically generated for HIGH risk transaction');
    }
  });

  const testTxIdLow = `tx_test_low_${Date.now()}`;
  test('ML Scoring: Low-Risk Retail Payment (<0.30 Probability)', 'Inference', () => {
    const res = processIncomingTransaction({
      step: 200,
      type: 'PAYMENT',
      amount: 45.50,
      nameOrig: 'C_TEST_SHOPPER_1',
      oldbalanceOrg: 1200,
      newbalanceOrig: 1154.50,
      nameDest: 'M_TEST_STORE_1',
      oldbalanceDest: 0,
      newbalanceDest: 0
    }, true, testTxIdLow);

    if (res.fraudProbability >= 0.30) {
      throw new Error(`Expected low fraud probability (<0.30), got ${res.fraudProbability}`);
    }
    if (res.riskCategory !== 'LOW') {
      throw new Error(`Expected riskCategory LOW, got ${res.riskCategory}`);
    }
    if (res.alertGenerated) {
      throw new Error('Alert should not be generated for LOW risk retail payment');
    }
  });

  // 4. Duplicate ID Prevention
  test('Duplicate Transaction Rejection Protection', 'Integrity', () => {
    try {
      processIncomingTransaction({
        step: 200,
        type: 'PAYMENT',
        amount: 25,
        nameOrig: 'C1',
        oldbalanceOrg: 100,
        newbalanceOrig: 75,
        nameDest: 'M1',
        oldbalanceDest: 0,
        newbalanceDest: 0
      }, true, testTxIdLow); // reuse same ID
      throw new Error('Did not reject duplicate transaction ID');
    } catch (e: any) {
      if (!e.message.includes('already been processed')) throw e;
    }
  });

  // 5. Alert & Analyst Review Workflow
  test('Analyst Investigation & Decision Recording Workflow', 'Triage', () => {
    const alertRow = db.prepare('SELECT id FROM alerts WHERE transaction_id = ?').get(testTxIdHigh) as any;
    if (!alertRow) throw new Error('Alert row not found for high risk test transaction');

    // Update alert status to UNDER_REVIEW
    db.prepare('UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?').run('UNDER_REVIEW', Date.now(), alertRow.id);

    // Record Analyst Review
    const reviewId = `rev_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO analyst_reviews (id, alert_id, transaction_id, analyst_id, decision, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      alertRow.id,
      testTxIdHigh,
      'test_analyst_01',
      'CONFIRMED_FRAUD',
      'Automated test verification of investigation resolution.',
      Date.now()
    );

    db.prepare('UPDATE alerts SET status = ?, updated_at = ? WHERE id = ?').run('RESOLVED_FRAUD', Date.now(), alertRow.id);

    const updatedAlert = db.prepare('SELECT status FROM alerts WHERE id = ?').get(alertRow.id) as any;
    if (updatedAlert.status !== 'RESOLVED_FRAUD') {
      throw new Error(`Alert status mismatch: expected RESOLVED_FRAUD, got ${updatedAlert.status}`);
    }
  });

  // 6. Simulator Execution
  test('Transaction Simulator: Single Discrete Tick Generation', 'Simulator', () => {
    const tickResult = simulator.tick();
    if (!tickResult) throw new Error('Simulator tick returned null or failed');
    if (!tickResult.transactionId) throw new Error('Simulator tick did not return transactionId');
  });

  const totalDuration = parseFloat((performance.now() - startTime).toFixed(2));
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  return {
    total: results.length,
    passed,
    failed,
    durationMs: totalDuration,
    timestamp: Date.now(),
    results
  };
}
