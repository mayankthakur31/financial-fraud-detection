import React, { useState } from 'react';
import { 
  Play, 
  Square, 
  Layers, 
  Activity, 
  Zap, 
  ShieldAlert, 
  AlertTriangle, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { SimulatorStatus } from '../types';
import { apiFetch } from '../utils/api';

interface SimulatorViewProps {
  status: SimulatorStatus | null;
  onRefreshStatus: () => void;
  onRefreshAllData: () => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  status,
  onRefreshStatus,
  onRefreshAllData
}) => {
  const [rate, setRate] = useState<number>(status?.ratePerSec || 1);
  const [selectedScenario, setScenario] = useState<string>(status?.scenario || 'MIXED_LIVE');
  const [actionLoading, setActionLoading] = useState(false);

  const isRunning = status?.isRunning ?? false;

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/simulator/start', {
        method: 'POST',
        body: JSON.stringify({ ratePerSec: rate, scenario: selectedScenario })
      });
      onRefreshStatus();
      onRefreshAllData();
    } catch (err: any) {
      alert(`Simulator start failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/simulator/stop', { method: 'POST' });
      onRefreshStatus();
      onRefreshAllData();
    } catch (err: any) {
      alert(`Simulator stop failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTick = async () => {
    setActionLoading(true);
    try {
      await apiFetch('/api/simulator/tick', { method: 'POST' });
      onRefreshStatus();
      onRefreshAllData();
    } catch (err: any) {
      alert(`Simulator tick failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const scenarios = [
    {
      id: 'MIXED_LIVE',
      title: 'Realistic Financial Mix',
      desc: '82% normal consumer retail & payroll, 18% account takeover drains & smurfing attacks.',
      badge: 'Balanced'
    },
    {
      id: 'ACCOUNT_TAKEOVER_DRAIN',
      title: 'Rapid Account Takeover Blitz',
      desc: 'Simulates targeted credentials theft: 100% account balance liquidation via high-value TRANSFER and zero destination balance.',
      badge: 'High Severity'
    },
    {
      id: 'SMURFING_RING',
      title: 'Smurfing / Structuring Ring',
      desc: 'Repeated structured transfers between $9,200 and $9,950 intentionally evading the $10,000 regulatory reporting threshold to a common collector node.',
      badge: 'AML Pattern'
    },
    {
      id: 'NORMAL_RETAIL',
      title: 'Normal Consumer Retail Peak',
      desc: 'Low-risk e-commerce payments, POS debits, and verified salary cash-ins with <0.05 probability.',
      badge: 'Low Risk'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Simulator Control Center Banner */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white">Real-Time Transaction Stream Simulator</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                isRunning
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}>
                {isRunning ? 'STREAM ACTIVE' : 'IDLE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Injects clearly labeled synthetic demonstration transactions directly into the real REST ingestion pipeline and database.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTick}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Single Discrete Tx</span>
            </button>

            {isRunning ? (
              <button
                onClick={handleStop}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Stream</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Stream</span>
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-slate-400 block text-[10px]">Total Generated</span>
            <span className="font-mono text-base font-bold text-white">{status?.totalGenerated || 0}</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-slate-400 block text-[10px]">Alerts Triggered</span>
            <span className="font-mono text-base font-bold text-rose-400">{status?.fraudAlertsGenerated || 0}</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-slate-400 block text-[10px]">Current Velocity</span>
            <span className="font-mono text-base font-bold text-cyan-400">{status?.ratePerSec || rate} tx / sec</span>
          </div>
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-slate-400 block text-[10px]">Active Scenario</span>
            <span className="font-mono text-xs font-semibold text-slate-300 truncate block mt-0.5">
              {status?.scenario || selectedScenario}
            </span>
          </div>
        </div>
      </div>

      {/* Scenario Selector & Rate Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scenario Selection Cards (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Attack Scenario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scenarios.map((sc) => {
              const isChosen = selectedScenario === sc.id;
              return (
                <div
                  key={sc.id}
                  onClick={() => {
                    setScenario(sc.id);
                    if (isRunning) {
                      // Restart with new scenario
                      apiFetch('/api/simulator/start', {
                        method: 'POST',
                        body: JSON.stringify({ ratePerSec: rate, scenario: sc.id })
                      }).then(() => onRefreshStatus());
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-xs space-y-2 ${
                    isChosen
                      ? 'border-cyan-500/50 bg-slate-800/70 shadow-md ring-1 ring-cyan-500/20'
                      : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{sc.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                      {sc.badge}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{sc.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rate Adjuster (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ingestion Frequency</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400">Rate:</span>
                <span className="font-mono font-bold text-white text-base">{rate} transactions / second</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={rate}
                onChange={(e) => {
                  const newRate = parseFloat(e.target.value);
                  setRate(newRate);
                  if (isRunning) {
                    apiFetch('/api/simulator/start', {
                      method: 'POST',
                      body: JSON.stringify({ ratePerSec: newRate, scenario: selectedScenario })
                    }).then(() => onRefreshStatus());
                  }
                }}
                className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5 tx/s</span>
                <span>2 tx/s</span>
                <span>4 tx/s (Max Safe)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 rounded bg-slate-950/60 border border-slate-800/60 text-[11px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">Bounded Ingestion Safeguard:</span>
            <span>Simulator operations run within bounds to ensure UI responsiveness and prevent infinite memory growth.</span>
          </div>
        </div>
      </div>

      {/* Live Stream Activity Table */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Live Synthetic Transaction Ingestion Stream</h2>
            <p className="text-xs text-slate-400">Real-time log of transactions scored by ML pipeline</p>
          </div>
          <button
            onClick={onRefreshStatus}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            title="Refresh stream"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider font-sans">
              <tr>
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Sender &rarr; Receiver</th>
                <th className="py-2.5 px-3 text-center">Fraud Risk</th>
                <th className="py-2.5 px-3 text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {status?.recentTransactions && status.recentTransactions.length > 0 ? (
                status.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      {tx.id}
                      <span className="ml-1.5 text-[9px] font-sans font-medium text-slate-500 border border-slate-800 px-1 rounded">
                        SYNTH
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">{tx.type}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-white">
                      ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {tx.nameOrig} &rarr; {tx.nameDest}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        tx.riskCategory === 'HIGH'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : tx.riskCategory === 'MEDIUM'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {(tx.fraudProbability * 100).toFixed(1)}% ({tx.riskCategory})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-semibold">
                      {tx.latencyMs}ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No recent synthetic transactions generated. Click "Start Stream" or "Generate Single Discrete Tx".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
