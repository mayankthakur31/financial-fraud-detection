import React from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  Zap, 
  DollarSign, 
  ArrowUpRight,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';
import { AnalyticsSummary, TrendItem, AlertItem } from '../types';

interface OverviewViewProps {
  summary: AnalyticsSummary | null;
  trends: TrendItem[];
  recentAlerts: AlertItem[];
  onSelectAlert: (alertId: string) => void;
  onNavigateToTransactions: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  trends,
  recentAlerts,
  onSelectAlert,
  onNavigateToTransactions
}) => {
  if (!summary) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400 mb-3"></div>
        <p className="text-sm">Loading platform telemetry and metrics...</p>
      </div>
    );
  }

  // Distribution data for Recharts
  const riskDistData = [
    { name: 'Low Risk', count: summary.lowRiskCount, fill: '#10b981' },
    { name: 'Medium Risk', count: summary.mediumRiskCount, fill: '#f59e0b' },
    { name: 'High Risk', count: summary.highRiskCount, fill: '#f43f5e' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Domain Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50">
        <div>
          <h1 className="text-lg font-semibold text-white">Financial Risk & Transaction Intelligence</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inference pipeline scoring against PaySim synthetic transaction distribution.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Avg Inference Latency</span>
            <span className="font-mono font-semibold text-cyan-400">{summary.averageInferenceLatencyMs} ms</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-500 block">Active Alerts</span>
            <span className="font-mono font-semibold text-amber-400">{summary.unresolvedAlerts} Pending</span>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <span className="text-slate-500 block">Confirmed Fraud</span>
            <span className="font-mono font-semibold text-rose-400">{summary.confirmedFraudCount} Cases</span>
          </div>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingested Transactions */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Transactions</span>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{summary.totalTransactions.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-2">
            <span>Gross Volume</span>
            <span className="font-mono text-slate-300">${summary.totalVolume.toLocaleString()}</span>
          </div>
        </div>

        {/* High Risk Predictions */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>High-Risk Flags</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400">{summary.highRiskCount}</span>
            <span className="text-xs text-slate-400">({summary.predictedRiskRate}% predicted rate)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-2">
            <span>Rule: Prob &ge; 0.70</span>
            <span className="text-rose-400 font-medium">Automatic Triage</span>
          </div>
        </div>

        {/* Unresolved Alerts */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Alerts in Triage Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">{summary.unresolvedAlerts}</span>
            <span className="text-xs text-slate-400">of {summary.totalAlerts} total</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-2">
            <span>Reviewed & Closed</span>
            <span className="text-slate-300 font-mono">{summary.confirmedFraudCount + summary.confirmedLegitimateCount}</span>
          </div>
        </div>

        {/* Confirmed Fraud Rate */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Confirmed Fraud Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{summary.confirmedFraudRate}%</span>
            <span className="text-xs text-slate-400 font-mono">({summary.confirmedFraudCount} confirmed)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60 pt-2">
            <span>False Positives Discarded</span>
            <span className="text-emerald-400 font-mono">{summary.confirmedLegitimateCount}</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transaction Volume & Risk Velocity Chart */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Transaction Volume & Fraud Risk Progression</h2>
              <p className="text-xs text-slate-400">Temporal distribution across simulation steps</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Total Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High Risk
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="riskColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="step" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="totalCount" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#volColor)" name="Total Transactions" />
                <Area type="monotone" dataKey="highRisk" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#riskColor)" name="High Risk Flags" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Breakdown */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Risk Tier Stratification</h2>
            <p className="text-xs text-slate-400 mb-4">Transactions classified by ML fraud probability</p>
            
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDistData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {riskDistData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-3 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Low Risk (&lt; 0.30)
              </span>
              <span className="font-mono text-slate-200">{summary.lowRiskCount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Medium Risk (0.30 - 0.69)
              </span>
              <span className="font-mono text-slate-200">{summary.mediumRiskCount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> High Risk (&ge; 0.70)
              </span>
              <span className="font-mono text-slate-200">{summary.highRiskCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Alert Triage Feed */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Priority Alerts Requiring Investigation</h2>
            <p className="text-xs text-slate-400">Directly actionable alerts from real-time fraud scoring</p>
          </div>
          <button
            onClick={onNavigateToTransactions}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All Transactions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No active alerts currently pending review.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 overflow-hidden">
            {recentAlerts.slice(0, 5).map((alert) => (
              <div 
                key={alert.id}
                onClick={() => onSelectAlert(alert.id)}
                className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/30 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded ${
                    alert.severity === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-200">{alert.transaction.id}</span>
                      <span className="text-slate-500 text-xs">·</span>
                      <span className="text-xs font-mono text-slate-300">{alert.transaction.type}</span>
                      <span className="text-slate-500 text-xs">·</span>
                      <span className="text-xs font-mono font-medium text-white">${alert.transaction.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>Sender: <strong className="font-mono text-slate-300">{alert.transaction.nameOrig}</strong></span>
                      <span className="text-slate-600">&rarr;</span>
                      <span>Beneficiary: <strong className="font-mono text-slate-300">{alert.transaction.nameDest}</strong></span>
                    </div>
                    {alert.triggers.length > 0 && (
                      <p className="text-[11px] text-rose-300/80 mt-1">
                        Trigger: {alert.triggers[0]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Fraud Probability</span>
                    <span className={`font-mono text-xs font-bold ${
                      alert.prediction.probability >= 0.70 ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {(alert.prediction.probability * 100).toFixed(1)}%
                    </span>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    alert.status === 'PENDING'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : alert.status === 'UNDER_REVIEW'
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      : alert.status === 'RESOLVED_FRAUD'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}>
                    {alert.status.replace('_', ' ')}
                  </span>

                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
