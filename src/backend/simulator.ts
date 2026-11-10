/**
 * Real-Time Transaction Simulator Engine
 * Generates clearly labeled synthetic transactions and submits them through the core ingestion pipeline.
 */

import { processIncomingTransaction, TransactionIngestResponse } from './ingestService.ts';

export type SimulatorScenario = 'MIXED_LIVE' | 'ACCOUNT_TAKEOVER_DRAIN' | 'SMURFING_RING' | 'NORMAL_RETAIL';

export interface SimulatorStatus {
  isRunning: boolean;
  scenario: SimulatorScenario;
  ratePerSec: number;
  totalGenerated: number;
  fraudAlertsGenerated: number;
  lastGeneratedTime: number | null;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    nameOrig: string;
    nameDest: string;
    fraudProbability: number;
    riskCategory: string;
    latencyMs: number;
    timestamp: number;
  }>;
}

class TransactionSimulator {
  private isRunning: boolean = false;
  private scenario: SimulatorScenario = 'MIXED_LIVE';
  private ratePerSec: number = 1;
  private timer: NodeJS.Timeout | null = null;
  private totalGenerated: number = 0;
  private fraudAlertsGenerated: number = 0;
  private lastGeneratedTime: number | null = null;
  private recentTransactions: SimulatorStatus['recentTransactions'] = [];
  private currentStep: number = 150;

  public getStatus(): SimulatorStatus {
    return {
      isRunning: this.isRunning,
      scenario: this.scenario,
      ratePerSec: this.ratePerSec,
      totalGenerated: this.totalGenerated,
      fraudAlertsGenerated: this.fraudAlertsGenerated,
      lastGeneratedTime: this.lastGeneratedTime,
      recentTransactions: this.recentTransactions.slice(0, 15)
    };
  }

  public start(ratePerSec: number = 1, scenario: SimulatorScenario = 'MIXED_LIVE'): SimulatorStatus {
    if (this.isRunning) {
      this.stop();
    }

    this.isRunning = true;
    this.ratePerSec = Math.max(0.2, Math.min(5, ratePerSec)); // Bounded between 0.2 and 5 tx/s to maintain stability
    this.scenario = scenario;

    const intervalMs = Math.round(1000 / this.ratePerSec);
    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);

    return this.getStatus();
  }

  public stop(): SimulatorStatus {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    return this.getStatus();
  }

  public tick(): TransactionIngestResponse | null {
    try {
      this.currentStep += 1;
      const tx = this.generateSyntheticTx(this.scenario, this.currentStep);
      const result = processIncomingTransaction(tx, true);

      this.totalGenerated += 1;
      this.lastGeneratedTime = Date.now();
      if (result.riskCategory === 'HIGH' || result.riskCategory === 'MEDIUM') {
        this.fraudAlertsGenerated += 1;
      }

      this.recentTransactions.unshift({
        id: result.transactionId,
        type: tx.type,
        amount: tx.amount,
        nameOrig: tx.nameOrig,
        nameDest: tx.nameDest,
        fraudProbability: result.fraudProbability,
        riskCategory: result.riskCategory,
        latencyMs: result.inferenceLatencyMs,
        timestamp: Date.now()
      });

      if (this.recentTransactions.length > 50) {
        this.recentTransactions.pop();
      }

      return result;
    } catch (err) {
      console.error('Simulator tick error:', err);
      return null;
    }
  }

  private generateSyntheticTx(scenario: SimulatorScenario, step: number) {
    const randomOrig = 'C' + Math.floor(100000000 + Math.random() * 900000000);
    const randomDest = (Math.random() > 0.4 ? 'C' : 'M') + Math.floor(100000000 + Math.random() * 900000000);

    if (scenario === 'ACCOUNT_TAKEOVER_DRAIN') {
      // High-risk account drain
      const balance = Math.round(50000 + Math.random() * 450000);
      const isDrain = Math.random() > 0.2;
      const amount = isDrain ? balance : Math.round(balance * 0.85);

      return {
        step,
        type: 'TRANSFER' as const,
        amount,
        nameOrig: randomOrig,
        oldbalanceOrg: balance,
        newbalanceOrig: balance - amount,
        nameDest: 'C' + Math.floor(990000000 + Math.random() * 9999999),
        oldbalanceDest: 0,
        newbalanceDest: 0, // PaySim hallmark
        timestamp: Date.now()
      };
    }

    if (scenario === 'SMURFING_RING') {
      // Structuring just below $10,000 threshold to common recipient
      const amount = Math.round(9200 + Math.random() * 750);
      const balance = Math.round(amount + 2000 + Math.random() * 15000);
      const fixedSink = 'C994829103'; // Common collector node

      return {
        step,
        type: 'TRANSFER' as const,
        amount,
        nameOrig: randomOrig,
        oldbalanceOrg: balance,
        newbalanceOrig: balance - amount,
        nameDest: fixedSink,
        oldbalanceDest: 12000,
        newbalanceDest: 12000 + amount,
        timestamp: Date.now()
      };
    }

    if (scenario === 'NORMAL_RETAIL') {
      const types: Array<'PAYMENT' | 'CASH_IN' | 'DEBIT' | 'TRANSFER'> = ['PAYMENT', 'PAYMENT', 'CASH_IN', 'DEBIT', 'TRANSFER'];
      const type = types[Math.floor(Math.random() * types.length)];
      const amount = parseFloat((10 + Math.random() * 350).toFixed(2));
      const oldBal = parseFloat((500 + Math.random() * 4000).toFixed(2));
      const newBal = type === 'CASH_IN' ? oldBal + amount : Math.max(0, oldBal - amount);

      return {
        step,
        type,
        amount,
        nameOrig: randomOrig,
        oldbalanceOrg: oldBal,
        newbalanceOrig: newBal,
        nameDest: 'M' + Math.floor(100000000 + Math.random() * 900000000),
        oldbalanceDest: 0,
        newbalanceDest: 0,
        timestamp: Date.now()
      };
    }

    // MIXED_LIVE: 82% normal, 18% fraud patterns
    const isSuspicious = Math.random() < 0.18;
    if (isSuspicious) {
      if (Math.random() > 0.5) {
        // High amount transfer drain
        const balance = Math.round(80000 + Math.random() * 320000);
        return {
          step,
          type: 'TRANSFER' as const,
          amount: balance,
          nameOrig: randomOrig,
          oldbalanceOrg: balance,
          newbalanceOrig: 0,
          nameDest: 'C' + Math.floor(880000000 + Math.random() * 9999999),
          oldbalanceDest: 0,
          newbalanceDest: 0,
          timestamp: Date.now()
        };
      } else {
        // Rapid Cash Out
        const balance = Math.round(25000 + Math.random() * 120000);
        return {
          step,
          type: 'CASH_OUT' as const,
          amount: balance,
          nameOrig: randomOrig,
          oldbalanceOrg: balance,
          newbalanceOrig: 0,
          nameDest: 'M' + Math.floor(550000000 + Math.random() * 9999999),
          oldbalanceDest: 0,
          newbalanceDest: balance,
          timestamp: Date.now()
        };
      }
    }

    // Normal transaction
    const normTypes: Array<'PAYMENT' | 'TRANSFER' | 'CASH_IN' | 'DEBIT'> = ['PAYMENT', 'PAYMENT', 'TRANSFER', 'CASH_IN', 'DEBIT'];
    const type = normTypes[Math.floor(Math.random() * normTypes.length)];
    const amount = parseFloat((15 + Math.random() * 600).toFixed(2));
    const oldBal = parseFloat((800 + Math.random() * 8000).toFixed(2));
    const newBal = type === 'CASH_IN' ? oldBal + amount : Math.max(0, oldBal - amount);

    return {
      step,
      type,
      amount,
      nameOrig: randomOrig,
      oldbalanceOrg: oldBal,
      newbalanceOrig: newBal,
      nameDest: (type === 'PAYMENT' ? 'M' : 'C') + Math.floor(100000000 + Math.random() * 900000000),
      oldbalanceDest: 1000,
      newbalanceDest: 1000 + (type === 'CASH_IN' ? 0 : amount),
      timestamp: Date.now()
    };
  }
}

export const simulator = new TransactionSimulator();
