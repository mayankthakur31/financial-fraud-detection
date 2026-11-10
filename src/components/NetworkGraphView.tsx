import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  Layers, 
  Maximize2, 
  RotateCcw,
  Info,
  DollarSign
} from 'lucide-react';
import { NetworkGraphData } from '../types';
import { apiFetch } from '../utils/api';

interface NetworkGraphViewProps {
  initialAccountId?: string;
}

export const NetworkGraphView: React.FC<NetworkGraphViewProps> = ({
  initialAccountId
}) => {
  const [targetAccount, setTargetAccount] = useState<string>(initialAccountId || '');
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const fetchGraph = async (accId?: string) => {
    setLoading(true);
    try {
      const url = accId && accId.trim() ? `/api/network/${encodeURIComponent(accId.trim())}` : '/api/network';
      const res = await apiFetch<NetworkGraphData>(url);
      setGraphData(res);
      if (res.nodes.length > 0) {
        setSelectedNode(res.nodes[0]);
      }
    } catch (err) {
      console.error('Failed to load network graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph(initialAccountId);
  }, [initialAccountId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGraph(targetAccount);
  };

  const handleReset = () => {
    setTargetAccount('');
    fetchGraph('');
  };

  // Compute 2D layout coordinates for SVG rendering using circular/force layout
  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];

  const width = 800;
  const height = 500;
  const centerX = width / 2;
  const centerY = height / 2;

  // Position nodes
  const nodeCoords = new Map<string, { x: number; y: number }>();
  if (nodes.length > 0) {
    if (graphData?.rootAccountId) {
      // Place root in center
      nodeCoords.set(graphData.rootAccountId, { x: centerX, y: centerY });
      const others = nodes.filter(n => n.id !== graphData.rootAccountId);
      others.forEach((n, idx) => {
        const angle = (idx / others.length) * 2 * Math.PI;
        const radius = n.type === 'INTERMEDIARY' ? 140 : 200;
        nodeCoords.set(n.id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        });
      });
    } else {
      nodes.forEach((n, idx) => {
        const angle = (idx / nodes.length) * 2 * Math.PI;
        const radius = 170 + (idx % 2 === 0 ? 30 : -20);
        nodeCoords.set(n.id, {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        });
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Controller Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-white">Suspicious Account Relationship Network</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Topology traversal of multi-hop transactions, shared counterparties, and pass-through money mules.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={targetAccount}
              onChange={(e) => setTargetAccount(e.target.value)}
              placeholder="Filter by account ID (e.g. C192847102)"
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Trace Network
          </button>
          {targetAccount && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Show Global Network"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Main Grid: Interactive Graph Canvas + Evidence Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SVG Graph Canvas (8 cols) */}
        <div className="lg:col-span-8 border border-slate-800 rounded-xl bg-slate-950/70 p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[520px]">
          {loading ? (
            <div className="py-24 text-center text-xs text-slate-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-400 mb-2"></div>
              <p>Analyzing transaction graph topology...</p>
            </div>
          ) : nodes.length === 0 ? (
            <div className="py-24 text-center text-xs text-slate-500">
              No relational connections found for account {targetAccount}.
            </div>
          ) : (
            <>
              {/* Legend overlay */}
              <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 text-[11px] space-y-1 backdrop-blur pointer-events-none z-10">
                <span className="font-semibold text-slate-300 block mb-1">Graph Legend</span>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High Risk Flagged Node
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Pass-Through Money Mule
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Standard Counterparty
                </div>
              </div>

              {/* Interactive SVG */}
              <svg 
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-full max-h-[500px]"
              >
                {/* Defs for arrowhead markers */}
                <defs>
                  <marker
                    id="arrowhead-normal"
                    markerWidth="8"
                    markerHeight="8"
                    refX="20"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 4, 0 8" fill="#475569" />
                  </marker>
                  <marker
                    id="arrowhead-flagged"
                    markerWidth="8"
                    markerHeight="8"
                    refX="20"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 4, 0 8" fill="#f43f5e" />
                  </marker>
                </defs>

                {/* Edges */}
                {edges.map((edge) => {
                  const source = nodeCoords.get(edge.source);
                  const target = nodeCoords.get(edge.target);
                  if (!source || !target) return null;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={edge.isFlagged ? '#f43f5e' : '#334155'}
                        strokeWidth={edge.isFlagged ? 2 : 1}
                        strokeDasharray={edge.type === 'TRANSFER' ? 'none' : '4 4'}
                        markerEnd={edge.isFlagged ? 'url(#arrowhead-flagged)' : 'url(#arrowhead-normal)'}
                      />
                    </g>
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const coord = nodeCoords.get(node.id);
                  if (!coord) return null;

                  const isSelected = selectedNode?.id === node.id;
                  const isHighRisk = node.isFlagged || node.riskScore >= 0.70;
                  const isMule = node.type === 'INTERMEDIARY';

                  const fillColor = isHighRisk ? '#f43f5e' : (isMule ? '#f59e0b' : '#06b6d4');

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${coord.x}, ${coord.y})`}
                      onClick={() => setSelectedNode(node)}
                      className="cursor-pointer transition-transform hover:scale-110"
                    >
                      <circle
                        r={isSelected ? 18 : 14}
                        fill={fillColor}
                        fillOpacity={0.25}
                        stroke={fillColor}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      <circle
                        r={6}
                        fill={fillColor}
                      />
                      <text
                        y={24}
                        textAnchor="middle"
                        fill="#cbd5e1"
                        fontSize="10"
                        fontFamily="monospace"
                        className="pointer-events-none select-none font-semibold"
                      >
                        {node.id}
                      </text>
                      {node.patternLabel && (
                        <text
                          y={-18}
                          textAnchor="middle"
                          fill="#f87171"
                          fontSize="9"
                          className="pointer-events-none select-none font-sans font-bold"
                        >
                          {node.patternLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </>
          )}
        </div>

        {/* Right Column: Node Details & Suspicious Patterns Evidence (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Node Inspector */}
          {selectedNode ? (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-semibold text-slate-300">Account Details</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  selectedNode.riskScore >= 0.70 
                    ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                    : 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                }`}>
                  {selectedNode.type}
                </span>
              </div>

              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Account ID:</span>
                  <span className="text-white font-bold">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Total Volume:</span>
                  <span className="text-slate-200">${selectedNode.totalVolume?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Network Degree:</span>
                  <span className="text-slate-200">{selectedNode.txCount} transactions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Peak Risk Score:</span>
                  <span className={selectedNode.riskScore >= 0.70 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                    {(selectedNode.riskScore * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setTargetAccount(selectedNode.id);
                  fetchGraph(selectedNode.id);
                }}
                className="w-full mt-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Focus Topology on {selectedNode.id}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 text-xs text-slate-500">
              Click any account node on the graph to inspect counterparties.
            </div>
          )}

          {/* Detected Laundering Patterns Panel */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3 text-xs">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Suspicious Network Topologies</span>
            </h3>

            {graphData?.suspiciousPatterns && graphData.suspiciousPatterns.length > 0 ? (
              <div className="space-y-3">
                {graphData.suspiciousPatterns.map((pat, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-300">{pat.patternType}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        {pat.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{pat.description}</p>
                    <div className="pt-1 text-[11px] text-slate-500 border-t border-slate-800/80">
                      <strong>Evidence:</strong> {pat.evidence}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                No complex multi-hop laundering clusters detected in the active view window.
              </div>
            )}

            <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
              Topological patterns represent risk indicators for investigation, not definitive proof of illegal syndicates.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
