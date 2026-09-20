import { Cpu, Loader2 } from "lucide-react";

interface LoadingSkeletonProps {
  rows?: number;
  phase?: string;
  title?: string;
  description?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  rows = 4,
  phase,
  title,
  description,
}) => {
  const displayTitle = title || (phase ? `Executing ${phase}...` : "Synthesizing Pipeline Telemetry...");
  const displayDesc =
    description || "Running multi-agent AST analysis, neural inference, and consensus checks.";

  return (
    <div className="space-y-6 font-mono select-none">
      {/* Top High-Tech Scanning Bar */}
      <div className="relative w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/80">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_12px_rgba(245,158,11,0.6)]" />
      </div>

      {/* Pipeline Status HUD Banner */}
      <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Cpu className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                {displayTitle}
              </span>
              <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold animate-pulse">
                IN PROGRESS
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-sans">{displayDesc}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-zinc-400 shrink-0">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span className="text-[11px] text-zinc-300">Live NIM Engine</span>
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800/80 space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 bg-zinc-800 rounded w-1/3 animate-pulse" />
              <div className="h-4 w-4 rounded-full bg-zinc-800/80 animate-pulse" />
            </div>
            <div className="h-7 bg-zinc-800/90 rounded w-1/2 animate-pulse" />
            <div className="h-2 bg-zinc-800/40 rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Left 2 Cols: Main View Skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="h-4 bg-zinc-800 rounded w-1/4 animate-pulse" />
              <div className="h-3 bg-zinc-800/60 rounded w-16 animate-pulse" />
            </div>
            <div className="space-y-2.5">
              <div className="h-3.5 bg-zinc-800/70 rounded w-full animate-pulse" />
              <div className="h-3.5 bg-zinc-800/50 rounded w-5/6 animate-pulse" />
              <div className="h-3.5 bg-zinc-800/60 rounded w-4/6 animate-pulse" />
            </div>
            <div className="p-4 rounded bg-zinc-950/80 border border-zinc-800/60 space-y-2">
              <div className="h-3 bg-zinc-800/80 rounded w-1/3 animate-pulse" />
              <div className="h-2.5 bg-zinc-800/50 rounded w-3/4 animate-pulse" />
              <div className="h-2.5 bg-zinc-800/40 rounded w-2/3 animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: Math.max(rows - 2, 2) }).map((_, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/70 space-y-2.5 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3.5 bg-zinc-800 rounded w-2/5" />
                  <div className="h-3 bg-zinc-800/60 rounded w-20" />
                </div>
                <div className="h-2.5 bg-zinc-800/50 rounded w-3/5" />
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Sidebar / Graph Skeleton */}
        <div className="space-y-4">
          <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-4">
            <div className="h-4 bg-zinc-800 rounded w-1/2 animate-pulse" />
            <div className="h-48 rounded bg-zinc-950/70 border border-zinc-800/60 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500/60 mx-auto" />
                <span className="text-[11px] text-zinc-500 block">Mapping Ast Nodes...</span>
              </div>
            </div>
            <div className="h-3 bg-zinc-800/40 rounded w-4/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};
