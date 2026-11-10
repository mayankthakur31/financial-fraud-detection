import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Layers, 
  Search, 
  Network, 
  BrainCircuit, 
  Play, 
  Square, 
  CheckCircle2, 
  FileCode2,
  Database
} from 'lucide-react';
import { SimulatorStatus } from '../types';

export type TabKey = 'overview' | 'transactions' | 'investigation' | 'network' | 'model' | 'simulator' | 'system';

interface HeaderProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  unresolvedAlertsCount: number;
  simulatorStatus: SimulatorStatus | null;
  onToggleSimulator: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  unresolvedAlertsCount,
  simulatorStatus,
  onToggleSimulator
}) => {
  const isSimRunning = simulatorStatus?.isRunning ?? false;

  const navItems: Array<{ key: TabKey; label: string; icon: React.ReactNode; badge?: number }> = [
    { key: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { key: 'transactions', label: 'Transactions', icon: <Search className="w-4 h-4" /> },
    { 
      key: 'investigation', 
      label: 'Investigation Desk', 
      icon: <ShieldAlert className="w-4 h-4" />, 
      badge: unresolvedAlertsCount > 0 ? unresolvedAlertsCount : undefined 
    },
    { key: 'network', label: 'Account Network', icon: <Network className="w-4 h-4" /> },
    { key: 'model', label: 'ML Insights', icon: <BrainCircuit className="w-4 h-4" /> },
    { key: 'simulator', label: 'Simulator Studio', icon: <Layers className="w-4 h-4" /> },
    { key: 'system', label: 'Verification & Docs', icon: <FileCode2 className="w-4 h-4" /> }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Sentinel</span>
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">Fraud Detection</span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Real-Time Risk Scoring & PaySim ML Engine</p>
            </div>
          </div>

          {/* System Status Indicators & Quick Simulator Control */}
          <div className="flex items-center gap-3">
            {/* Database indicator */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 border border-slate-800 bg-slate-950/60 px-2.5 py-1 rounded-md">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>SQLite ACID</span>
            </div>

            {/* Model indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 border border-slate-800 bg-slate-950/60 px-2.5 py-1 rounded-md">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="font-mono text-slate-300">v1.4-xgb (94.2% Prec)</span>
            </div>

            {/* Quick Simulator Start/Stop Button */}
            <button
              onClick={onToggleSimulator}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                isSimRunning 
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
              }`}
            >
              {isSimRunning ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Simulator ({simulatorStatus?.ratePerSec || 1} tx/s)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Live Simulator</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clean Segmented Tab Navigation Bar */}
        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60 text-xs">
          {navItems.map((item) => {
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onSelectTab(item.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
