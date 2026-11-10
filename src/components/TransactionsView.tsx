import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle,
  X,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { Transaction } from '../types';
import { apiFetch } from '../utils/api';

interface TransactionsViewProps {
  onInvestigateAlert: (alertId: string) => void;
  onExploreNetwork: (accountId: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  onInvestigateAlert,
  onExploreNetwork
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Selected Transaction for Drawer Detail
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        search,
        type: typeFilter,
        risk: riskFilter,
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (minAmount) query.append('min_amount', minAmount);
      if (maxAmount) query.append('max_amount', maxAmount);

      const res = await apiFetch<{
        transactions: Transaction[];
        total: number;
        totalPages: number;
      }>(`/api/transactions?${query.toString()}`);

      setTransactions(res.transactions);
      setTotal(res.total);
      setPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, typeFilter, riskFilter, statusFilter, sortBy, sortOrder]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleOpenDetail = async (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailLoading(true);
    try {
      const full = await apiFetch<any>(`/api/transactions/${tx.id}`);
      setSelectedTx(full);
    } catch (err) {
      console.error('Detail fetch failed:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction ID, originator account (C...), or beneficiary (C... / M...)"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Filter Records
          </button>
        </form>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60 text-xs">
          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Types</option>
              <option value="TRANSFER">TRANSFER (High Risk)</option>
              <option value="CASH_OUT">CASH_OUT (High Risk)</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="CASH_IN">CASH_IN</option>
              <option value="DEBIT">DEBIT</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Risk:</span>
            <select
              value={riskFilter}
              onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="HIGH">High Risk (&ge; 0.70)</option>
              <option value="MEDIUM">Medium Risk (0.30 - 0.69)</option>
              <option value="LOW">Low Risk (&lt; 0.30)</option>
            </select>
          </div>

          {/* Alert Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Alert Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ALERT_OPEN">Open Alerts (Pending/Review)</option>
              <option value="RESOLVED">Resolved (Confirmed/Legitimate)</option>
              <option value="NO_ALERT">No Alert Generated</option>
            </select>
          </div>

          {/* Amount range */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Amount:</span>
            <input
              type="number"
              placeholder="Min $"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
            />
            <span className="text-slate-500">-</span>
            <input
              type="number"
              placeholder="Max $"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
            />
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="timestamp">Ingestion Time</option>
              <option value="fraud_probability">Fraud Probability</option>
              <option value="amount">Transaction Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
              className="p-1 border border-slate-800 rounded bg-slate-950 text-slate-300 hover:text-white"
              title={`Toggle sort order (Current: ${sortOrder})`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Sender (Orig)</th>
                <th className="py-3 px-4">Beneficiary (Dest)</th>
                <th className="py-3 px-4 text-center">Fraud Risk</th>
                <th className="py-3 px-4 text-center">Alert State</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-400 mb-2"></div>
                    <p>Loading transaction ledger...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                    No transactions found matching your criteria. Try resetting the filters.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const prob = tx.prediction?.probability ?? 0;
                  const risk = tx.prediction?.riskCategory ?? 'LOW';

                  return (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(tx)}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {tx.id}
                        {tx.isSynthetic && (
                          <span className="ml-1.5 text-[9px] font-sans font-medium text-slate-500 border border-slate-800 px-1 rounded">
                            SYNTH
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans">
                        <span className={`font-mono text-xs ${
                          tx.type === 'TRANSFER' ? 'text-amber-300' : tx.type === 'CASH_OUT' ? 'text-rose-300' : 'text-slate-400'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-white">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <button
                          onClick={(e) => { e.stopPropagation(); onExploreNetwork(tx.nameOrig); }}
                          className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Explore account network"
                        >
                          <span>{tx.nameOrig}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <button
                          onClick={(e) => { e.stopPropagation(); onExploreNetwork(tx.nameDest); }}
                          className="hover:text-cyan-400 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Explore beneficiary network"
                        >
                          <span>{tx.nameDest}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`text-xs font-bold ${
                            risk === 'HIGH' ? 'text-rose-400' : risk === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {(prob * 100).toFixed(1)}%
                          </span>
                          <span className={`text-[10px] font-sans font-medium px-1.5 py-0.5 rounded ${
                            risk === 'HIGH' 
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20' 
                              : risk === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}>
                            {risk}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {tx.alert ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            tx.alert.status === 'PENDING'
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : tx.alert.status === 'UNDER_REVIEW'
                              ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                              : tx.alert.status === 'RESOLVED_FRAUD'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          }`}>
                            {tx.alert.status.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenDetail(tx); }}
                          className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded text-xs transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-3 px-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-200">{transactions.length}</span> of{' '}
            <span className="font-semibold text-slate-200">{total}</span> transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1 rounded border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">Page {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1 rounded border border-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Slide-Over Inspection Drawer Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-white">{selectedTx.id}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    selectedTx.prediction?.riskCategory === 'HIGH' 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : selectedTx.prediction?.riskCategory === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {selectedTx.prediction?.riskCategory} RISK
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Inference model: <strong className="font-mono text-slate-300">{selectedTx.prediction?.modelVersion || 'v1.4-xgb-calibrated'}</strong> ({selectedTx.prediction?.latencyMs || 3.2}ms)
                </p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {selectedTx.alert && (
                <button
                  onClick={() => {
                    const alertId = selectedTx.alert!.id;
                    setSelectedTx(null);
                    onInvestigateAlert(alertId);
                  }}
                  className="flex-1 py-2 px-3 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Investigate in Alert Desk</span>
                </button>
              )}
              <button
                onClick={() => {
                  const account = selectedTx.nameOrig;
                  setSelectedTx(null);
                  onExploreNetwork(account);
                }}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                <span>Explore Account Network</span>
              </button>
            </div>

            {/* Account & Balance Discrepancy Breakdown */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Balance & Arithmetic Verification</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Sender Card */}
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70">
                  <span className="text-[11px] text-slate-400 font-sans block mb-1">Originator (Sender)</span>
                  <div className="font-mono font-bold text-slate-200">{selectedTx.nameOrig}</div>
                  <div className="mt-2 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Initial:</span>
                      <span className="font-mono text-white">${selectedTx.oldbalanceOrg?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Final:</span>
                      <span className="font-mono text-white">${selectedTx.newbalanceOrig?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-[11px]">
                      <span>Delta Error:</span>
                      <span className={`font-mono ${
                        (selectedTx.newbalanceOrig + selectedTx.amount - selectedTx.oldbalanceOrg) !== 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        ${(selectedTx.newbalanceOrig + selectedTx.amount - selectedTx.oldbalanceOrg).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Beneficiary Card */}
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70">
                  <span className="text-[11px] text-slate-400 font-sans block mb-1">Beneficiary (Recipient)</span>
                  <div className="font-mono font-bold text-slate-200">{selectedTx.nameDest}</div>
                  <div className="mt-2 space-y-1 text-slate-400">
                    <div className="flex justify-between">
                      <span>Initial:</span>
                      <span className="font-mono text-white">${selectedTx.oldbalanceDest?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Final:</span>
                      <span className="font-mono text-white">${selectedTx.newbalanceDest?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-1 text-[11px]">
                      <span>Delta Error:</span>
                      <span className={`font-mono ${
                        (selectedTx.oldbalanceDest + selectedTx.amount - selectedTx.newbalanceDest) !== 0 ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        ${(selectedTx.oldbalanceDest + selectedTx.amount - selectedTx.newbalanceDest).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explainable AI / Top Feature Attributions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Feature Importance Attribution (Local SHAP)</span>
              </h3>
              
              <div className="space-y-2">
                {selectedTx.prediction?.attributions && selectedTx.prediction.attributions.length > 0 ? (
                  selectedTx.prediction.attributions.map((attr, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/40 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-200">{attr.description}</span>
                        <span className={`font-mono font-bold ${attr.contribution > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {attr.contribution > 0 ? `+${attr.contribution.toFixed(2)}` : attr.contribution.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Feature: <code className="text-slate-400">{attr.feature}</code></span>
                        <span>Value: <strong className="text-slate-300 font-mono">{String(attr.value)}</strong></span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No feature attribution vectors recorded.</p>
                )}
              </div>
            </div>

            {/* Rule Triggers */}
            {selectedTx.alert?.triggers && selectedTx.alert.triggers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Triggered Risk Indicators</h3>
                <div className="space-y-1.5">
                  {selectedTx.alert.triggers.map((trigger, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{trigger}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
