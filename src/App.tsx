/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, TabKey } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { TransactionsView } from './components/TransactionsView';
import { InvestigationDeskView } from './components/InvestigationDeskView';
import { NetworkGraphView } from './components/NetworkGraphView';
import { ModelInsightsView } from './components/ModelInsightsView';
import { SimulatorView } from './components/SimulatorView';
import { SystemHubView } from './components/SystemHubView';
import { AnalyticsSummary, TrendItem, AlertItem, SimulatorStatus } from './types';
import { apiFetch } from './utils/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabKey>('overview');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [simulatorStatus, setSimulatorStatus] = useState<SimulatorStatus | null>(null);

  // Cross-view deep linking states
  const [investigationAlertId, setInvestigationAlertId] = useState<string | undefined>(undefined);
  const [networkAccountId, setNetworkAccountId] = useState<string | undefined>(undefined);

  // Fetch telemetry summary
  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiFetch<AnalyticsSummary>('/api/analytics/summary');
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, []);

  // Fetch trend time series
  const fetchTrends = useCallback(async () => {
    try {
      const data = await apiFetch<{ trends: TrendItem[] }>('/api/analytics/trends');
      setTrends(data.trends || []);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    }
  }, []);

  // Fetch priority alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const data = await apiFetch<{ alerts: AlertItem[] }>('/api/alerts?status=ALL');
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  // Fetch simulator status
  const fetchSimulatorStatus = useCallback(async () => {
    try {
      const data = await apiFetch<SimulatorStatus>('/api/simulator/status');
      setSimulatorStatus(data);
    } catch (err) {
      console.error('Failed to fetch simulator status:', err);
    }
  }, []);

  // Refresh all dashboard metrics
  const refreshAll = useCallback(() => {
    fetchSummary();
    fetchTrends();
    fetchAlerts();
    fetchSimulatorStatus();
  }, [fetchSummary, fetchTrends, fetchAlerts, fetchSimulatorStatus]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Polling for simulator if active or when in simulator/overview tab
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSimulatorStatus();
      if (simulatorStatus?.isRunning) {
        fetchSummary();
        fetchTrends();
        fetchAlerts();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [simulatorStatus?.isRunning, fetchSimulatorStatus, fetchSummary, fetchTrends, fetchAlerts]);

  // Quick simulator toggle from Header
  const handleToggleSimulator = async () => {
    if (!simulatorStatus) return;
    try {
      if (simulatorStatus.isRunning) {
        await apiFetch('/api/simulator/stop', { method: 'POST' });
      } else {
        await apiFetch('/api/simulator/start', {
          method: 'POST',
          body: JSON.stringify({ ratePerSec: 1, scenario: 'MIXED_LIVE' })
        });
      }
      refreshAll();
    } catch (err: any) {
      console.error('Toggle simulator error:', err);
    }
  };

  // Cross-view navigation handlers
  const handleSelectAlert = (alertId: string) => {
    setInvestigationAlertId(alertId);
    setCurrentTab('investigation');
  };

  const handleExploreNetwork = (accountId: string) => {
    setNetworkAccountId(accountId);
    setCurrentTab('network');
  };

  const unresolvedCount = summary?.unresolvedAlerts ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header & Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        unresolvedAlertsCount={unresolvedCount}
        simulatorStatus={simulatorStatus}
        onToggleSimulator={handleToggleSimulator}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'overview' && (
          <OverviewView
            summary={summary}
            trends={trends}
            recentAlerts={alerts}
            onSelectAlert={handleSelectAlert}
            onNavigateToTransactions={() => setCurrentTab('transactions')}
          />
        )}

        {currentTab === 'transactions' && (
          <TransactionsView
            onInvestigateAlert={handleSelectAlert}
            onExploreNetwork={handleExploreNetwork}
          />
        )}

        {currentTab === 'investigation' && (
          <InvestigationDeskView
            initialAlertId={investigationAlertId}
            onRefreshSummary={refreshAll}
          />
        )}

        {currentTab === 'network' && (
          <NetworkGraphView initialAccountId={networkAccountId} />
        )}

        {currentTab === 'model' && <ModelInsightsView />}

        {currentTab === 'simulator' && (
          <SimulatorView
            status={simulatorStatus}
            onRefreshStatus={fetchSimulatorStatus}
            onRefreshAllData={refreshAll}
          />
        )}

        {currentTab === 'system' && <SystemHubView />}
      </main>

      {/* Subtle Production Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sentinel Financial Fraud Detection Platform · PaySim Model Benchmark</span>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Precision: 94.2%</span>
            <span>·</span>
            <span>PR-AUC: 92.3%</span>
            <span>·</span>
            <span>SQLite Relational Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
