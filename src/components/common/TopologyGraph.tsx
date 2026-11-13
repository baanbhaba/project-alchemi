import React, { useState } from "react";
import { MermaidDiagram } from "./MermaidDiagram";
import { Layers, Network, Box, ArrowRightLeft, Cpu } from "lucide-react";

interface NodeItem {
  id: string;
  name: string;
  type: "java_class" | "rust_struct" | "axum_route" | "db_table";
  status: "legacy" | "migrated" | "pending";
}

interface TopologyGraphProps {
  mermaidChart: string;
  id: string;
  nodes?: string[];
  edges?: { from: string; to: string }[];
  transformedCode?: string;
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  mermaidChart,
  id,
  nodes = [],
  edges = [],
  transformedCode = "",
}) => {
  const [viewMode, setViewMode] = useState<"flowchart" | "topology3d">("flowchart");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Generate interactive topology nodes if nodes/edges passed
  const graphNodes: NodeItem[] = nodes.map((n) => ({
    id: n.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    name: n,
    type: n.includes("Controller") || n.includes("Route")
      ? "axum_route"
      : n.includes("Repository") || n.includes("Entity")
      ? "db_table"
      : "java_class",
    status: transformedCode ? "migrated" : "legacy",
  }));

  return (
    <div className="space-y-3 font-mono">
      {/* View Switcher Controls */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            Visualization Model
          </span>
        </div>

        <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode("flowchart")}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              viewMode === "flowchart"
                ? "bg-amber-500 text-black font-bold shadow-xs"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2D Flowchart</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("topology3d")}
            className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              viewMode === "topology3d"
                ? "bg-amber-500 text-black font-bold shadow-xs"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>3D Topology Schema</span>
          </button>
        </div>
      </div>

      {/* 2D Flowchart View */}
      {viewMode === "flowchart" && (
        <MermaidDiagram chart={mermaidChart} id={id} />
      )}

      {/* 3D / Interactive Topology View */}
      {viewMode === "topology3d" && (
        <div className="space-y-3">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl relative overflow-hidden min-h-[220px] flex flex-col justify-between transition-colors">
            {/* Background mesh grid effect */}
            <div className="absolute inset-0 bg-[radial-gradient(#a1a1aa_1px,transparent_1px)] dark:bg-[radial-gradient(#3f3f46_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

            <div className="flex items-center justify-between text-[10px] text-zinc-500 z-10">
              <span className="flex items-center space-x-1 font-bold text-amber-600 dark:text-amber-500">
                <Box className="w-3.5 h-3.5" />
                <span>CHAINED TOPOLOGY NODE CANVAS</span>
              </span>
              <span>Click node to inspect mapped Rust struct</span>
            </div>

            {/* Nodes Render Canvas */}
            <div className="py-6 flex flex-wrap items-center justify-center gap-4 z-10">
              {graphNodes.length > 0 ? (
                graphNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNode(node.name)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      selectedNode === node.name
                        ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/50 scale-105"
                        : "bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-3 text-xs font-bold">
                      <span>{node.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono">
                        {node.type.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] text-zinc-500">
                      <ArrowRightLeft className="w-3 h-3 text-green-400" />
                      <span>Java ➔ Rust Axum</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center text-xs text-zinc-500 py-8">
                  No topology nodes detected yet. Run Blueprint Transformation step to build topology.
                </div>
              )}
            </div>

            {/* Edge details */}
            {edges.length > 0 && (
              <div className="text-[10px] text-zinc-500 z-10 flex items-center space-x-2 pt-2 border-t border-zinc-900 overflow-x-auto">
                <span className="font-bold text-zinc-400">Edges:</span>
                {edges.map((e, idx) => (
                  <span key={idx} className="bg-zinc-900 px-2 py-0.5 rounded text-zinc-400 border border-zinc-800 shrink-0">
                    {e.from} &rarr; {e.to}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Node detail inspector */}
          {selectedNode && (
            <div className="p-3 bg-zinc-900 border border-amber-500/30 rounded-lg space-y-1 text-xs animate-in fade-in">
              <div className="flex items-center space-x-2 text-amber-400 font-bold">
                <Cpu className="w-3.5 h-3.5" />
                <span>Node Inspector &mdash; {selectedNode}</span>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Mapped from Java class <code className="text-zinc-200">{selectedNode}</code> to Rust struct <code className="text-amber-300">{selectedNode}Service</code>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
