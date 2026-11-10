import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  UserCheck, 
  FileText, 
  History, 
  Sparkles, 
  CheckCircle2, 
  XCircle,
  AlertCircle
} from 'lucide-react';
import { AlertItem } from '../types';
import { apiFetch } from '../utils/api';

interface InvestigationDeskViewProps {
  initialAlertId?: string;
  onRefreshSummary: () => void;
}

export const InvestigationDeskView: React.FC<InvestigationDeskViewProps> = ({
  initialAlertId,
  onRefreshSummary
}) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(initialAlertId || null);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filter state for queue
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Analyst review form
  const [decision, setDecision] = useState<'CONFIRMED_FRAUD' | 'LEGITIMATE' | 'ESCALATED'>('CONFIRMED_FRAUD');
  const [analystId, setAnalystId] = useState('analyst_alex_w');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoadingList(true);
    try {
      const res = await apiFetch<{ alerts: AlertItem[] }>(
        `/api/alerts?status=${statusFilter}&severity=${severityFilter}`
      );
      setAlerts(res.alerts);
      if (res.alerts.length > 0 && !selectedAlertId) {
        setSelectedAlertId(res.alerts[0].id);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const loadAlertDetail = async (id: string) => {
    setLoadingDetail(true);
    setActionSuccess(null);
    try {
      // Find alert transactionId
      const targetAlert = alerts.find(a => a.id === id);
      if (targetAlert) {
        const tx = await apiFetch<any>(`/api/transactions/${targetAlert.transactionId}`);
        setSelectedDetail({ ...tx, alertInfo: targetAlert });
      }
    } catch (err) {
      console.error('Failed to load alert detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedAlertId) {
      loadAlertDetail(selectedAlertId);
    }
  }, [selectedAlertId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDetail || !notes.trim()) return;

    setSubmitting(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          alertId: selectedDetail.alertInfo.id,
          transactionId: selectedDetail.id,
          analystId,
          decision,
          notes: notes.trim()
        })
      });

      setActionSuccess(`Investigation decision recorded: ${decision.replace('_', ' ')}`);
      setNotes('');
      // Reload alerts and detail
      await fetchAlerts();
      await loadAlertDetail(selectedDetail.alertInfo.id);
      onRefreshSummary();
    } catch (err: any) {
      alert(`Review submission error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Investigation Desk Header */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">Fraud Alert Investigation Workbench</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Triage suspected transactions, evaluate ML attributions, and document formal audit resolutions.
          </p>
        </div>

        {/* Triage filters */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Queue:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="ALL">All Alerts</option>
              <option value="PENDING">Pending Triage</option>
              <option value="UNDER_REVIEW">In Review</option>
              <option value="RESOLVED_FRAUD">Confirmed Fraud</option>
              <option value="RESOLVED_LEGITIMATE">Marked Legitimate</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Split-Screen Workbench Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: Alerts Priority Queue (5 cols) */}
        <div className="lg:col-span-5 border border-slate-800 rounded-xl bg-slate-900/40 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 text-xs text-slate-400">
            <span>Alert Queue ({alerts.length})</span>
            <span className="font-mono text-[11px]">Ranked by Probability</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[700px]">
            {loadingList ? (
              <div className="py-16 text-center text-xs text-slate-500">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-cyan-400 mb-2"></div>
                <p>Loading active alerts...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-500">
                No alerts matching queue filters.
              </div>
            ) : (
              alerts.map((item) => {
                const isSelected = selectedAlertId === item.id;
                const prob = item.prediction?.probability ?? 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedAlertId(item.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                      isSelected 
                        ? 'border-cyan-500/50 bg-slate-800/80 shadow-md ring-1 ring-cyan-500/20' 
                        : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          item.severity === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}></span>
                        <span className="font-mono font-bold text-slate-200">{item.transactionId}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${
                        prob >= 0.70 ? 'text-rose-400' : 'text-amber-400'
                      }`}>
                        {(prob * 100).toFixed(1)}% Prob
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 mb-1.5 text-[11px]">
                      <span>{item.transaction.type}</span>
                      <span className="font-mono text-white font-medium">
                        ${item.transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate max-w-[180px]">
                        {item.transaction.nameOrig} &rarr; {item.transaction.nameDest}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-medium border ${
                        item.status === 'PENDING'
                          ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                          : item.status === 'RESOLVED_FRAUD'
                          ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                          : item.status === 'RESOLVED_LEGITIMATE'
                          ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                          : 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                      }`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: In-Depth Investigation Dossier & Decision Recording (7 cols) */}
        <div className="lg:col-span-7 border border-slate-800 rounded-xl bg-slate-900/40 p-5 flex flex-col justify-between">
          {loadingDetail || !selectedDetail ? (
            <div className="py-24 text-center text-slate-500 text-xs">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-400 mb-2"></div>
              <p>Loading dossier details...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white font-mono">{selectedDetail.id}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      selectedDetail.prediction?.riskCategory === 'HIGH'
                        ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                    }`}>
                      {selectedDetail.prediction?.riskCategory} SEVERITY
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Alert ID: <strong className="font-mono text-slate-300">{selectedDetail.alertInfo?.id}</strong> · Status: <span className="font-semibold text-cyan-300">{selectedDetail.alertInfo?.status.replace('_', ' ')}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">ML Calculated Risk</span>
                  <span className={`text-xl font-mono font-bold ${
                    (selectedDetail.prediction?.probability || 0) >= 0.70 ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {((selectedDetail.prediction?.probability || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Action Banner if Success */}
              {actionSuccess && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Transaction Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                  <span className="text-[10px] text-slate-400 block">Amount</span>
                  <span className="font-mono font-bold text-white text-sm">
                    ${selectedDetail.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                  <span className="text-[10px] text-slate-400 block">Transaction Type</span>
                  <span className="font-mono font-semibold text-amber-300">{selectedDetail.type}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                  <span className="text-[10px] text-slate-400 block">Originator Balance</span>
                  <span className="font-mono text-slate-300">${selectedDetail.oldbalanceOrg?.toLocaleString()} &rarr; ${selectedDetail.newbalanceOrig?.toLocaleString()}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60">
                  <span className="text-[10px] text-slate-400 block">Beneficiary Balance</span>
                  <span className="font-mono text-slate-300">${selectedDetail.oldbalanceDest?.toLocaleString()} &rarr; ${selectedDetail.newbalanceDest?.toLocaleString()}</span>
                </div>
              </div>

              {/* Triggered Rule Indicators */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Triggered Risk Indicators</h3>
                <div className="space-y-1.5">
                  {selectedDetail.alert?.triggers && selectedDetail.alert.triggers.length > 0 ? (
                    selectedDetail.alert.triggers.map((trigger: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-md">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{trigger}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">Standard heuristic thresholds satisfied.</div>
                  )}
                </div>
              </div>

              {/* Historical Review Timeline */}
              {selectedDetail.reviews && selectedDetail.reviews.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Prior Analyst Decisions & Notes</span>
                  </h3>
                  <div className="space-y-2">
                    {selectedDetail.reviews.map((rev: any) => (
                      <div key={rev.id} className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-200">
                            Analyst: <strong className="text-cyan-400">{rev.analyst_id}</strong>
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            rev.decision === 'CONFIRMED_FRAUD'
                              ? 'border-rose-500/30 bg-rose-500/15 text-rose-300'
                              : rev.decision === 'LEGITIMATE'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                              : 'border-amber-500/30 bg-amber-500/15 text-amber-300'
                          }`}>
                            {rev.decision.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-slate-300 text-xs italic">{rev.notes}</p>
                        <div className="text-[10px] text-slate-500">
                          {new Date(rev.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyst Decision Recording Form */}
              <form onSubmit={handleSubmitReview} className="border-t border-slate-800 pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Record Analyst Judgment & Action</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Determination Decision</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setDecision('CONFIRMED_FRAUD')}
                        className={`py-1.5 px-2 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                          decision === 'CONFIRMED_FRAUD'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Confirmed Fraud
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision('LEGITIMATE')}
                        className={`py-1.5 px-2 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                          decision === 'LEGITIMATE'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Legitimate
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision('ESCALATED')}
                        className={`py-1.5 px-2 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                          decision === 'ESCALATED'
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        Escalate (L2)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Investigating Analyst ID</label>
                    <input
                      type="text"
                      value={analystId}
                      onChange={(e) => setAnalystId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-xs">Investigation Findings & Case Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Document evidence: customer telephone callback status, IP geolocation correlation, destination freeze actions taken..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !notes.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {submitting ? 'Saving Review...' : 'Submit Resolution'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
