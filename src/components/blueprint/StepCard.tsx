import React, { useEffect, useState, useRef } from "react";
import type { BlueprintStep } from "../../types/contracts";
import { Badge } from "../common/Badge";
import {
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  Sparkles,
  Copy,
  CheckCheck,
  Loader2,
  Cpu,
  Terminal,
  Code2,
  Play,
  RotateCw,
} from "lucide-react";
import { useUiStore } from "../../store/useUiStore";
import { triggerTransformation } from "../../api/transform";
import { getProjectSourceCode } from "../../api/project";

interface StepCardProps {
  step: BlueprintStep;
  projectId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onApprove: (stepId: string) => void;
  onOpenRejectModal: (stepId: string, file: string) => void;
  onOpenEditModal: (step: BlueprintStep) => void;
  allSteps: BlueprintStep[];
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  projectId,
  isExpanded,
  onToggleExpand,
  onApprove,
  onOpenRejectModal,
  onOpenEditModal,
  allSteps,
}) => {
  const { viewedSteps, markStepViewed } = useUiStore();
  const isViewed = (viewedSteps[projectId] || []).includes(step.id);

  const [transformedRustCode, setTransformedRustCode] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformError, setTransformError] = useState<string | null>(null);
  const [sourceCodeMap, setSourceCodeMap] = useState<Record<string, string>>({});

  // Enhanced UI state
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copiedJava, setCopiedJava] = useState(false);
  const [copiedRust, setCopiedRust] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSourceCodeMap(getProjectSourceCode(projectId));
  }, [projectId]);

  const codeEntries = Object.entries(sourceCodeMap);
  let rawJavaCode = sourceCodeMap[step.file_or_module];
  if (!rawJavaCode && codeEntries.length > 0) {
    const match = codeEntries.find(
      ([k]) =>
        k.toLowerCase().includes(step.file_or_module.toLowerCase()) ||
        step.file_or_module.toLowerCase().includes(k.toLowerCase())
    );
    rawJavaCode = match ? match[1] : codeEntries.map(([_, v]) => v).join("\n\n");
  }
  if (!rawJavaCode) {
    rawJavaCode = `// Legacy Source: ${step.file_or_module}\n// Target Java 21 / Rust Axum Migration`;
  }

  useEffect(() => {
    if (isExpanded && !isViewed) {
      markStepViewed(projectId, step.id);
    }
  }, [isExpanded, isViewed, markStepViewed, projectId, step.id]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleCardClick = () => {
    if (!isViewed) {
      markStepViewed(projectId, step.id);
    }
    onToggleExpand();
  };

  const handleCopy = (text: string, type: "java" | "rust") => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    if (type === "java") {
      setCopiedJava(true);
      setTimeout(() => setCopiedJava(false), 2000);
    } else {
      setCopiedRust(true);
      setTimeout(() => setCopiedRust(false), 2000);
    }
  };

  const handleRunTransformation = async () => {
    setIsTransforming(true);
    setTransformError(null);
    setProgress(12);
    setProgressStage("Parsing Java AST & deprecated patterns...");
    const startTime = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(Number(elapsed.toFixed(1)));

      setProgress((prev) => {
        if (prev < 35) {
          setProgressStage("Parsing Java AST & deprecated patterns...");
          return prev + 6;
        } else if (prev < 70) {
          setProgressStage("Invoking NVIDIA NIM Engine (Llama 3.2)...");
          return prev + 4;
        } else if (prev < 90) {
          setProgressStage("Synthesizing Idiomatic Rust Axum Router & Structs...");
          return prev + 2;
        } else {
          setProgressStage("Finalizing Transformation Contract...");
          return Math.min(prev + 0.5, 95);
        }
      });
    }, 150);

    try {
      const res = await triggerTransformation(projectId, step.id, step.file_or_module);
      setProgress(100);
      setProgressStage("Transformation Complete");
      setTransformedRustCode(res.transformed_code);
      step.target_pattern = res.transformed_code;
    } catch (err) {
      setTransformError(err instanceof Error ? err.message : "Transformation failed");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsTransforming(false);
    }
  };

  const prereqSteps = step.depends_on.map((depId) => {
    const found = allSteps.find((s) => s.id === depId);
    return {
      id: depId,
      file: found?.file_or_module || depId,
      status: found?.status || "pending",
    };
  });

  const displayRustCode =
    transformedRustCode ||
    (step.target_pattern && !step.target_pattern.includes("ModuleHandler")
      ? step.target_pattern
      : null);

  const renderCodeLines = (code: string) => {
    const lines = code.split("\n");
    return (
      <div className="flex font-mono text-[11px] leading-relaxed">
        <div className="select-none pr-3 text-right text-zinc-600 dark:text-zinc-500 border-r border-zinc-800/80 mr-3 shrink-0">
          {lines.map((_, i) => (
            <div key={i} className="h-5">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto whitespace-pre flex-1 text-zinc-200">
          {lines.map((line, i) => (
            <div key={i} className="h-5">
              {line || "\u00A0"}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      data-testid={`step-card-${step.id}`}
      className={`rounded-lg border transition-all overflow-hidden font-mono ${
        step.status === "approved"
          ? "bg-zinc-50 dark:bg-zinc-900/60 border-amber-500/50 shadow-sm"
          : step.status === "rejected"
          ? "bg-red-50/30 dark:bg-red-950/20 border-red-300 dark:border-red-800"
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      {/* Header Bar */}
      <div
        onClick={handleCardClick}
        className="p-4 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            type="button"
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Toggle step details"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-amber-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          <span className="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-bold shrink-0">
            {step.id}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {step.file_or_module}
              </span>
              <Badge variant={step.risk_level} />
              {isViewed ? (
                <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700 shrink-0">
                  REVIEWED
                </span>
              ) : (
                <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30 shrink-0">
                  NEW
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-sans">
              {step.what_changes}
            </p>
          </div>
        </div>

        {/* Actions & Status */}
        <div
          className="flex items-center space-x-3 ml-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Badge variant={step.status} />

          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => onOpenEditModal(step)}
              className="p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
              title="Edit step"
              data-testid={`edit-btn-${step.id}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onOpenRejectModal(step.id, step.file_or_module)}
              disabled={step.status === "rejected"}
              className={`p-1.5 rounded border ${
                step.status === "rejected"
                  ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
                  : "bg-zinc-100 dark:bg-zinc-800 hover:bg-red-500/10 text-red-600 dark:text-red-400 border-zinc-200 dark:border-zinc-700"
              }`}
              title="Reject step"
              data-testid={`reject-btn-${step.id}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onApprove(step.id)}
              disabled={step.status === "approved"}
              className={`px-2.5 py-1 rounded text-xs font-bold flex items-center space-x-1 border transition-colors ${
                step.status === "approved"
                  ? "bg-amber-500/10 text-amber-500 border-amber-500/40 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600 text-black border-amber-500 shadow-sm"
              }`}
              data-testid={`approve-btn-${step.id}`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{step.status === "approved" ? "Approved" : "Approve"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/70">
          {/* Controls Bar: Prerequisites & Transform Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-zinc-100/70 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800/80">
            <div className="flex items-center space-x-2 text-xs">
              <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-500" />
                Prerequisites:
              </span>
              {prereqSteps.length > 0 ? (
                prereqSteps.map((prereq) => (
                  <span
                    key={prereq.id}
                    className="px-2 py-0.5 rounded border text-[11px] bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  >
                    requires: {prereq.id} ({prereq.file})
                  </span>
                ))
              ) : (
                <span className="italic text-zinc-500 dark:text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded text-[11px]">
                  None (Baseline Step)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunTransformation}
                disabled={isTransforming}
                className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-bold transition-all shadow-md ${
                  isTransforming
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-wait"
                    : displayRustCode
                    ? "bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/40 hover:border-amber-400"
                    : "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-500 text-black border border-amber-400"
                }`}
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Transforming Code...</span>
                  </>
                ) : displayRustCode ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-Transform</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-black animate-pulse" />
                    <span>Transform Step</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time AI Progress Bar (when transforming) */}
          {isTransforming && (
            <div className="p-3.5 rounded-lg bg-zinc-900/90 border border-amber-500/30 space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2 text-amber-400 font-semibold">
                  <Cpu className="w-4 h-4 animate-spin text-amber-400" />
                  <span>{progressStage}</span>
                </div>
                <div className="flex items-center space-x-2 text-zinc-400 text-[11px]">
                  <span>{elapsedTime.toFixed(1)}s</span>
                  <span className="text-amber-400 font-bold">{Math.round(progress)}%</span>
                </div>
              </div>

              {/* Glowing Progress Bar Track */}
              <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-200 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Java Source vs Target Code Diff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Window: Before Legacy Source */}
            <div className="rounded-lg border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-lg flex flex-col">
              {/* Terminal Window Chrome */}
              <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 ml-2">
                    Before: Legacy Source ({step.file_or_module})
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.2 rounded font-bold">
                    JAVA
                  </span>
                  <button
                    onClick={() => handleCopy(rawJavaCode, "java")}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    title="Copy Java code"
                  >
                    {copiedJava ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Code Body */}
              <div className="p-3 overflow-x-auto max-h-72 min-h-48 flex-1 bg-zinc-950/60">
                {renderCodeLines(rawJavaCode)}
              </div>
            </div>

            {/* Right Window: After Migration Target Code */}
            <div
              className={`rounded-lg border overflow-hidden shadow-lg flex flex-col transition-all ${
                displayRustCode
                  ? "border-amber-500/40 bg-[#0d1117] shadow-amber-500/5"
                  : isTransforming
                  ? "border-amber-500/50 bg-[#0d1117] animate-pulse"
                  : "border-zinc-800 bg-[#0d1117]"
              }`}
            >
              {/* Terminal Window Chrome */}
              <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 ml-2">
                    After: Migration Target Code
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {displayRustCode ? (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      RUST AXUM
                    </span>
                  ) : (
                    <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-1.5 py-0.2 rounded font-mono">
                      NVIDIA NIM
                    </span>
                  )}
                  {displayRustCode && (
                    <button
                      onClick={() => handleCopy(displayRustCode, "rust")}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Copy Rust code"
                    >
                      {copiedRust ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Code Body or Shimmering / Placeholder State */}
              <div className="p-3 overflow-x-auto max-h-72 min-h-48 flex-1 bg-zinc-950/60 flex flex-col justify-center">
                {isTransforming ? (
                  <div className="space-y-2 py-4 px-2">
                    <div className="flex items-center space-x-2 text-amber-400 text-xs font-mono mb-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Synthesizing idiomatic Rust with NVIDIA NIM...</span>
                    </div>
                    <div className="h-3.5 bg-zinc-800/80 rounded w-3/4 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/50 rounded w-1/2 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/70 rounded w-5/6 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/40 rounded w-2/3 animate-pulse" />
                    <div className="h-3.5 bg-zinc-800/60 rounded w-4/5 animate-pulse" />
                  </div>
                ) : displayRustCode ? (
                  renderCodeLines(displayRustCode)
                ) : transformError ? (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 font-mono">
                    <span className="font-bold block mb-1">Transformation Error:</span>
                    <span>{transformError}</span>
                  </div>
                ) : (
                  <div className="text-center py-6 px-4 space-y-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-200">
                        Target Code Not Yet Generated
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto font-sans">
                        Click below to execute the live NVIDIA NIM agent and generate production-ready Rust Axum code.
                      </p>
                    </div>
                    <button
                      onClick={handleRunTransformation}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded shadow-md transition-all"
                    >
                      <Play className="w-3 h-3 fill-black" />
                      <span>Run AI Transformation</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {transformError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 font-mono flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Transformation Error Details:</span>
                <span>{transformError}</span>
              </div>
            </div>
          )}

          {step.status === "rejected" && step.rejection_reason && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              <div className="flex items-center space-x-1.5 font-bold">
                <TriangleAlert className="w-4 h-4 shrink-0 text-red-500" />
                <span>Rejection Reason:</span>
              </div>
              <p className="font-mono mt-1 text-[11px]">{step.rejection_reason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
