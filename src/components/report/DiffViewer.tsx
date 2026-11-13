import React, { useState } from "react";
import { Columns, AlignJustify, Check, Copy, ChevronDown, ChevronRight, ShieldCheck, Cpu, MemoryStick, Terminal } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  javaCode?: string;
  rustCode?: string;
  unitName?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  javaCode = "",
  rustCode = "",
  unitName = "Module",
}) => {
  const [mode, setMode] = useState<"side-by-side" | "unified">("side-by-side");
  const [copiedRust, setCopiedRust] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const handleCopyRust = () => {
    navigator.clipboard.writeText(rustCode || diff);
    setCopiedRust(true);
    setTimeout(() => setCopiedRust(false), 2000);
  };

  const javaLines = javaCode ? javaCode.split("\n") : [];
  const rustLines = rustCode ? rustCode.split("\n") : [];

  return (
    <div className="space-y-2 font-mono text-xs">
      {/* View Selector Controls Header */}
      <div className="flex flex-wrap items-center justify-between bg-zinc-100 dark:bg-zinc-900 px-3 py-2 rounded-t border-t border-x border-zinc-200 dark:border-zinc-800 gap-2 transition-colors">
        <div className="flex items-center space-x-2 text-[11px] text-zinc-400">
          <span className="font-bold text-amber-500">{unitName}</span>
          <span>&mdash; Code Comparison & Detailed Analysis</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            {showTechnicalDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Deep Tech Spec & Breakdown</span>
          </button>

          <div className="flex items-center space-x-1 bg-white dark:bg-zinc-950 p-1 rounded border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setMode("side-by-side")}
              className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                mode === "side-by-side"
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("unified")}
              className={`px-2.5 py-1 rounded text-[10px] font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                mode === "unified"
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>Unified Diff</span>
            </button>
          </div>

          {rustCode && (
            <button
              type="button"
              onClick={handleCopyRust}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-[10px] flex items-center space-x-1 border border-zinc-700 font-bold transition-all cursor-pointer"
            >
              {copiedRust ? <Check className="w-3 h-3 text-amber-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedRust ? "Copied Rust" : "Copy Rust"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Technical Specification Drawer */}
      {showTechnicalDetails && (
        <div className="bg-amber-50/50 dark:bg-zinc-900/90 border-x border-b border-amber-500/30 p-3.5 rounded-b space-y-3 animate-in fade-in transition-colors">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-2">
            <Cpu className="w-4 h-4" />
            <span>Target Rust Axum Module Spec & Technical Breakdown</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
            {/* Memory & Safety */}
            <div className="bg-white dark:bg-zinc-950 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Memory & Safety Guarantees</span>
              </div>
              <ul className="text-zinc-600 dark:text-zinc-400 text-[10px] space-y-0.5 font-sans">
                <li>• <strong>Ownership & Borrowing:</strong> Zero Garbage Collector pauses.</li>
                <li>• <strong>Null Pointer Elimination:</strong> Replaced with <code className="text-amber-600 dark:text-amber-300">Option&lt;T&gt;</code> & <code className="text-amber-600 dark:text-amber-300">Result&lt;T, E&gt;</code>.</li>
                <li>• <strong>Thread Safety:</strong> Strictly enforced <code className="text-amber-600 dark:text-amber-300">Send + Sync</code> at compile time.</li>
              </ul>
            </div>

            {/* Performance Delta */}
            <div className="bg-white dark:bg-zinc-950 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-bold">
                <MemoryStick className="w-3.5 h-3.5" />
                <span>Resource Delta Estimates</span>
              </div>
              <ul className="text-zinc-600 dark:text-zinc-400 text-[10px] space-y-0.5 font-sans">
                <li>• <strong>RAM Footprint:</strong> ~150MB (JVM) ➔ ~9MB (Rust) [<strong className="text-emerald-600 dark:text-emerald-400">-94%</strong>].</li>
                <li>• <strong>Startup Latency:</strong> ~4.2s (Spring Boot) ➔ ~12ms (Axum) [<strong className="text-emerald-600 dark:text-emerald-400">-99%</strong>].</li>
                <li>• <strong>Concurrency:</strong> Tokio non-blocking async IO loops.</li>
              </ul>
            </div>

            {/* Axum Integration */}
            <div className="bg-white dark:bg-zinc-950 p-2.5 rounded border border-zinc-200 dark:border-zinc-800 space-y-1">
              <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-bold">
                <Terminal className="w-3.5 h-3.5" />
                <span>Framework Mapping</span>
              </div>
              <ul className="text-zinc-600 dark:text-zinc-400 text-[10px] space-y-0.5 font-sans">
                <li>• <strong>HTTP Framework:</strong> Axum 0.7.</li>
                <li>• <strong>JSON Serialization:</strong> Serde JSON zero-copy parsing.</li>
                <li>• <strong>Async Runtime:</strong> Tokio 1.0 multi-threaded worker pool.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Split View */}
      {mode === "side-by-side" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-zinc-900 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-b p-3 transition-colors">
          {/* Legacy Java Side */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800 pb-1">
              <span>Legacy Java Source Code</span>
              <span className="text-[9px] text-zinc-500">{javaLines.length} lines</span>
            </div>
            <div className="max-h-96 overflow-y-auto font-mono text-[11px] text-zinc-300 leading-relaxed bg-red-950/10 p-2.5 rounded border border-red-900/30 space-y-0.5">
              {javaLines.map((line, idx) => (
                <div key={idx} className="flex hover:bg-red-950/20">
                  <span className="w-8 select-none text-zinc-600 text-right pr-2 shrink-0">{idx + 1}</span>
                  <span className="whitespace-pre overflow-x-auto text-red-300/90">{line}</span>
                </div>
              ))}
              {javaLines.length === 0 && <span className="italic text-zinc-600">No Java source available</span>}
            </div>
          </div>

          {/* Migrated Rust Side */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800 pb-1">
              <span>Migrated Rust Axum Source Code</span>
              <span className="text-[9px] text-zinc-500">{rustLines.length} lines</span>
            </div>
            <div className="max-h-96 overflow-y-auto font-mono text-[11px] text-emerald-300 leading-relaxed bg-emerald-950/10 p-2.5 rounded border border-emerald-900/30 space-y-0.5">
              {rustLines.map((line, idx) => (
                <div key={idx} className="flex hover:bg-emerald-950/20">
                  <span className="w-8 select-none text-zinc-600 text-right pr-2 shrink-0">{idx + 1}</span>
                  <span className="whitespace-pre overflow-x-auto font-semibold">{line}</span>
                </div>
              ))}
              {rustLines.length === 0 && <span className="italic text-zinc-600">No Rust code generated yet for this step</span>}
            </div>
          </div>
        </div>
      )}

      {/* Unified Diff View */}
      {mode === "unified" && (
        <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-300 border border-zinc-300 dark:border-zinc-800 rounded-b p-3 font-mono text-xs overflow-x-auto leading-relaxed max-h-96 transition-colors">
          {diff.split("\n").map((line, idx) => {
            let style = "text-zinc-400";
            let bg = "";

            if (line.startsWith("+") && !line.startsWith("+++")) {
              style = "text-emerald-400 font-semibold";
              bg = "bg-emerald-950/30 -mx-3 px-3 block";
            } else if (line.startsWith("-") && !line.startsWith("---")) {
              style = "text-red-400 opacity-90 line-through";
              bg = "bg-red-950/30 -mx-3 px-3 block";
            } else if (line.startsWith("@")) {
              style = "text-amber-400 font-bold";
              bg = "bg-zinc-900 -mx-3 px-3 block";
            } else if (line.startsWith("---") || line.startsWith("+++")) {
              style = "text-zinc-500 font-bold";
            }

            return (
              <div key={idx} className={`${bg} ${style} whitespace-pre`}>
                {line}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
