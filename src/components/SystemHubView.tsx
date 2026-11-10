import React, { useState } from 'react';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Code2, 
  Terminal, 
  ShieldCheck, 
  BookOpen, 
  Copy, 
  Check
} from 'lucide-react';
import { apiFetch } from '../utils/api';

interface TestResultItem {
  name: string;
  category: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  error?: string;
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  timestamp: number;
  results: TestResultItem[];
}

export const SystemHubView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const summary = await apiFetch<TestSummary>('/api/tests/run', { method: 'POST' });
      setTestSummary(summary);
    } catch (err: any) {
      alert(`Test run error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const curlExample = `curl -X POST http://localhost:3000/api/transactions \\
  -H "Content-Type: application/json" \\
  -d '{
    "step": 150,
    "type": "TRANSFER",
    "amount": 280000.00,
    "nameOrig": "C192847102",
    "oldbalanceOrg": 280000.00,
    "newbalanceOrig": 0.00,
    "nameDest": "C883920194",
    "oldbalanceDest": 0.00,
    "newbalanceDest": 0.00
  }'`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">System Verification, Automated Tests & API Docs</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Execute real automated validation suites against the backend database and ML scoring pipeline.
          </p>
        </div>
        <button
          onClick={handleRunTests}
          disabled={running}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          {running ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
              <span>Executing Tests...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Automated Test Suite</span>
            </>
          )}
        </button>
      </div>

      {/* Test Suite Results Section */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Automated Verification Suite</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live validation of DB foreign keys, input constraints, model inference, alert triggers, and duplicate prevention.
            </p>
          </div>

          {testSummary && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-bold">{testSummary.passed} Passed</span>
              <span className="text-slate-600">/</span>
              <span className={testSummary.failed > 0 ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                {testSummary.failed} Failed
              </span>
              <span className="text-slate-500 font-sans">({testSummary.durationMs}ms total)</span>
            </div>
          )}
        </div>

        {testSummary ? (
          <div className="space-y-2">
            {testSummary.results.map((t, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                  t.status === 'PASSED'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-rose-500/30 bg-rose-500/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  {t.status === 'PASSED' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-[11px] text-slate-400 font-sans">Category: {t.category}</div>
                    {t.error && (
                      <p className="text-rose-300 font-mono text-[11px] mt-1 bg-rose-950/60 p-1.5 rounded">
                        Error: {t.error}
                      </p>
                    )}
                  </div>
                </div>

                <span className="font-mono text-slate-400 text-[11px] shrink-0">
                  {t.durationMs} ms
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
            Click "Run Automated Test Suite" to execute all tests against live backend components.
          </div>
        )}
      </div>

      {/* REST API Endpoints Contract & cURL Examples */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <span>Documented REST API Endpoints</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">GET</span>
              <span className="text-white">/api/health</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Health and readiness probe, database status, and loaded model version.</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold text-[10px]">POST</span>
              <span className="text-white">/api/transactions</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Ingest transaction, calculate ML features, score probability, persist and trigger alerts.</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">GET</span>
              <span className="text-white">/api/transactions</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Paginated search with query filters (type, risk, status, amount min/max).</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold text-[10px]">POST</span>
              <span className="text-white">/api/reviews</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Submit formal analyst investigation decisions (CONFIRMED_FRAUD, LEGITIMATE, ESCALATED).</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">GET</span>
              <span className="text-white">/api/network/:accountId</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Traverse multi-hop counterparties and detect laundering topology patterns.</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">GET</span>
              <span className="text-white">/api/model-insights</span>
            </div>
            <p className="font-sans text-[11px] text-slate-400">Retrieve actual validation metrics, confusion matrix, and Gini feature importances.</p>
          </div>
        </div>

        {/* cURL Ingestion Snippet */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Example Ingestion Command (cURL / Bash / PowerShell)</span>
            <button
              onClick={() => copyToClipboard(curlExample, 'curl')}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              {copiedKey === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'curl' ? 'Copied' : 'Copy cURL'}</span>
            </button>
          </div>
          <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
            {curlExample}
          </pre>
        </div>
      </div>

      {/* Windows PowerShell Setup Guide */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Local Deployment on Windows PowerShell</span>
        </h2>
        <p className="text-xs text-slate-400">
          The project provides ready-to-run Windows PowerShell scripts for setting up a local Python 3.10+ virtual environment and running FastAPI + Pytest.
        </p>

        <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-slate-500"># 1. Run full-stack TypeScript platform (Express + SQLite + React):</div>
          <div className="text-cyan-400">npm run dev</div>
          <div className="text-slate-500 pt-2"># 2. Or run Python FastAPI backend with virtualenv on Windows:</div>
          <div className="text-cyan-400">.\run_python_backend.ps1</div>
          <div className="text-slate-500 pt-2"># 3. Or run ML training pipeline:</div>
          <div className="text-cyan-400">python ml/train.py</div>
        </div>
      </div>
    </div>
  );
};
