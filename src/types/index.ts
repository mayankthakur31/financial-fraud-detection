export interface Transaction {
  id: string;
  step: number;
  type: 'PAYMENT' | 'TRANSFER' | 'CASH_OUT' | 'DEBIT' | 'CASH_IN';
  amount: number;
  nameOrig: string;
  oldbalanceOrg: number;
  newbalanceOrig: number;
  nameDest: string;
  oldbalanceDest: number;
  newbalanceDest: number;
  timestamp: number;
  isSynthetic: boolean;
  prediction: {
    probability: number;
    riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
    modelVersion: string;
    latencyMs: number;
    attributions?: Array<{
      feature: string;
      value: string | number;
      contribution: number;
      description: string;
    }>;
  };
  alert: {
    id: string;
    status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED_LEGITIMATE' | 'RESOLVED_FRAUD' | 'ESCALATED';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    triggers: string[];
  } | null;
}

export interface AlertItem {
  id: string;
  transactionId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED_LEGITIMATE' | 'RESOLVED_FRAUD' | 'ESCALATED';
  triggers: string[];
  createdAt: number;
  updatedAt: number;
  transaction: {
    id: string;
    type: 'PAYMENT' | 'TRANSFER' | 'CASH_OUT' | 'DEBIT' | 'CASH_IN';
    amount: number;
    nameOrig: string;
    nameDest: string;
    timestamp: number;
  };
  prediction: {
    probability: number;
    riskCategory: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

export interface AnalyticsSummary {
  totalTransactions: number;
  totalVolume: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalAlerts: number;
  unresolvedAlerts: number;
  confirmedFraudCount: number;
  confirmedLegitimateCount: number;
  predictedRiskRate: number;
  confirmedFraudRate: number;
  averageInferenceLatencyMs: number;
}

export interface TrendItem {
  step: string;
  stepNumber: number;
  totalCount: number;
  totalVolume: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
}

export interface ModelInsightsData {
  version: string;
  algorithm: string;
  trainedAt: number;
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    prAuc: number;
    rocAuc: number;
  };
  confusionMatrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
  featureImportance: Array<{
    feature: string;
    importance: number;
    description: string;
  }>;
  trainingDataset: {
    name: string;
    samples: number;
    fraudPrevalence: string;
    classImbalanceRatio: string;
    handlingTechnique: string;
  };
}

export interface NetworkGraphData {
  rootAccountId?: string;
  nodes: Array<{
    id: string;
    type: 'ORIGINATOR' | 'BENEFICIARY' | 'MERCHANT' | 'INTERMEDIARY';
    isFlagged: boolean;
    totalVolume: number;
    txCount: number;
    riskScore: number;
    patternLabel?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    amount: number;
    type: string;
    timestamp: number;
    riskCategory: string;
    isFlagged: boolean;
  }>;
  suspiciousPatterns: Array<{
    patternType: string;
    description: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    involvedAccounts: string[];
    evidence: string;
  }>;
}

export interface SimulatorStatus {
  isRunning: boolean;
  scenario: string;
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
