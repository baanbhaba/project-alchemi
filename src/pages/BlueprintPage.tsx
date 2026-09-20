import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GitPullRequest, CircleCheckBig, Expand, Shrink, AlertCircle, MoveRight, Eye, Info, Sparkles } from "lucide-react";
import {
  getBlueprint,
  regenerateBlueprintWithNvidiaAI,
  approveBlueprintStep,
  rejectBlueprintStep,
  updateBlueprintStep,
  approveAllBlueprintSteps,
} from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import type { BlueprintStep } from "../types/contracts";
import { Card } from "../components/common/Card";
import { StepCard } from "../components/blueprint/StepCard";
import { StepRejectModal } from "../components/blueprint/StepRejectModal";
import { StepEditModal } from "../components/blueprint/StepEditModal";
import { ConfirmBulkApproveModal } from "../components/blueprint/ConfirmBulkApproveModal";
import { LoadingSkeleton } from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorState";
import { ApprovalWorkflowCard } from "../components/blueprint/ApprovalWorkflowCard";
import { useUiStore } from "../store/useUiStore";

export const BlueprintPage: React.FC = () => {
  const { isDevMode } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    viewedSteps,
    expandedSteps,
    toggleStepExpanded,
    expandAllSteps,
    collapseAllSteps,
    markAllStepsViewed,
  } = useUiStore();

  const [rejectModalStepId, setRejectModalStepId] = useState<string | null>(null);
  const [rejectModalFile, setRejectModalFile] = useState<string>("");
  const [editingStep, setEditingStep] = useState<BlueprintStep | null>(null);
  const [isConfirmBulkOpen, setIsConfirmBulkOpen] = useState(false);

  const {
    data: blueprint,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["blueprint", id],
    queryFn: () => getBlueprint(id || ""),
    enabled: !!id,
  });

  useEffect(() => {
    if (isError && error && (error as any).status === 404) {
      navigate("/404", { replace: true });
    }
  }, [isError, error, navigate]);

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateBlueprintWithNvidiaAI(id || ""),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blueprint", id] }),
  });

  const approveMutation = useMutation({
    mutationFn: (stepId: string) => approveBlueprintStep(id || "", stepId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["blueprint", id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ stepId, reason }: { stepId: string; reason: string }) =>
      rejectBlueprintStep(id || "", stepId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint", id] });
      setRejectModalStepId(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({
      stepId,
      patch,
    }: {
      stepId: string;
      patch: { what_changes: string; target_pattern: string };
    }) => updateBlueprintStep(id || "", stepId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint", id] });
      setEditingStep(null);
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      return approveAllBlueprintSteps(id || "");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blueprint", id] });
      setIsConfirmBulkOpen(false);
      navigate(`/projects/${id}/report`);
    },
  });

  const sortedSteps = useMemo(() => {
    if (!blueprint?.steps) return [];
    const steps = [...blueprint.steps];
    return steps.sort((a, b) => {
      if (a.depends_on.includes(b.id)) return 1;
      if (b.depends_on.includes(a.id)) return -1;
      return a.depends_on.length - b.depends_on.length;
    });
  }, [blueprint]);

  if (isLoading)
    return (
      <LoadingSkeleton
        phase="Migration Blueprint Synthesis"
        description="Synthesizing multi-step migration blueprint, dependency orderings, and code transformation targets."
      />
    );
  if (isError) {
    return (
      <ErrorState
        title="Failed to load Blueprint"
        message={error instanceof Error ? error.message : "Error fetching blueprint steps"}
        onRetry={refetch}
      />
    );
  }
  if (!blueprint) return null;

  const projectViewedSteps = viewedSteps[id || ""] || [];
  const allViewed = sortedSteps.every((s) => projectViewedSteps.includes(s.id));
  const unviewedCount = sortedSteps.filter((s) => !projectViewedSteps.includes(s.id)).length;

  const approvedCount = sortedSteps.filter((s) => s.status === "approved").length;
  const rejectedCount = sortedSteps.filter((s) => s.status === "rejected").length;
  const pendingCount = sortedSteps.filter((s) => s.status === "pending").length;

  const uniqueFilesCount = new Set(sortedSteps.map((s) => s.file_or_module)).size;

  const handleApproveAllClick = () => {
    if (allViewed) {
      setIsConfirmBulkOpen(true);
    }
  };

  const handleMarkAllAsViewed = () => {
    const allStepIds = sortedSteps.map((s) => s.id);
    markAllStepsViewed(id || "", allStepIds);
  };

  return (
    <div className="space-y-6">
      {/* Regeneration active loading banner */}
      {regenerateMutation.isPending && (
        <div className="p-4 rounded-lg bg-zinc-900 border border-amber-500/40 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-amber-400 font-bold">
              <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
              <span>Generating Fresh AI Blueprint with NVIDIA NIM...</span>
            </div>
            <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              SYNTHESIZING
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
            <div className="h-full bg-gradient-to-r from-amber-500 via-amber-300 to-emerald-400 animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 font-mono">
            <span>Blueprint Human Review</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-sans">
            Review and approve individual transformation steps ordered by dependency prerequisites.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDevMode && (
            <button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>
                {regenerateMutation.isPending
                  ? "Generating Live AI Steps..."
                  : "Generate AI Blueprint (NVIDIA NIM)"}
              </span>
            </button>
          )}

          {!allViewed && (
            <button
              onClick={handleMarkAllAsViewed}
              className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded border border-zinc-300 dark:border-zinc-700 flex items-center space-x-1.5"
              title="Mark all steps as viewed to enable bulk approval"
              data-testid="mark-all-viewed-btn"
            >
              <Eye className="w-3.5 h-3.5 text-amber-500" />
              <span>Mark All Reviewed</span>
            </button>
          )}

          <button
            onClick={handleApproveAllClick}
            disabled={!allViewed || sortedSteps.length === 0}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded text-xs font-bold transition-all ${
              allViewed && sortedSteps.length > 0
                ? "bg-amber-500 hover:bg-amber-600 text-black shadow-2xs"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border border-zinc-200 dark:border-zinc-700 cursor-not-allowed"
            }`}
            data-testid="approve-all-btn"
          >
            <span>Approve All & Execute</span>
          </button>
        </div>
      </div>

      {!allViewed && (
        <div className="p-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 text-xs font-mono">
          <Info className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Review Required: You have <strong>{unviewedCount} unreviewed step(s)</strong>. Inspect each step to enable bulk approval.
          </span>
        </div>
      )}

      {/* Role-Based Governance Card */}
      <ApprovalWorkflowCard
        projectName={id || "Active Service"}
        totalSteps={sortedSteps.length}
        approvedSteps={approvedCount}
      />

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 font-mono text-xs">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block">Total Steps</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{sortedSteps.length}</span>
          </div>
          <GitPullRequest className="w-5 h-5 text-zinc-400" />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block">Approved</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{approvedCount}</span>
          </div>
          <CircleCheckBig className="w-5 h-5 text-zinc-400" />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block">Rejected</span>
            <span className="text-lg font-bold text-amber-500">{rejectedCount}</span>
          </div>
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block">Pending</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{pendingCount}</span>
          </div>
          <div className="text-xs font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            {Math.round((approvedCount / (sortedSteps.length || 1)) * 100)}%
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-zinc-400 uppercase block">Confidence Score</span>
            <span className="text-lg font-bold text-amber-500">92%</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">HIGH</span>
        </div>
      </div>

      {/* Blueprint Steps */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <GitPullRequest className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Transformation Steps</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <button
                onClick={() => expandAllSteps(sortedSteps.map((s) => s.id))}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700 flex items-center space-x-1"
              >
                <Expand className="w-3 h-3" />
                <span>Expand All</span>
              </button>
              <button
                onClick={collapseAllSteps}
                className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700 flex items-center space-x-1"
              >
                <Shrink className="w-3 h-3" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        }
        subtitle="Ordered topographically: prerequisite dependencies are listed before downstream modules"
      >
        <div className="space-y-3">
          {sortedSteps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              projectId={id || ""}
              isExpanded={expandedSteps.includes(step.id)}
              onToggleExpand={() => toggleStepExpanded(step.id)}
              onApprove={(stepId) => approveMutation.mutate(stepId)}
              onOpenRejectModal={(stepId, file) => {
                setRejectModalStepId(stepId);
                setRejectModalFile(file);
              }}
              onOpenEditModal={(st) => setEditingStep(st)}
              allSteps={sortedSteps}
            />
          ))}
        </div>
      </Card>

      <div className="pt-6 border-t-2 border-[#181c24] dark:border-[#30363d] flex justify-between items-center font-mono">
        <span className="text-xs text-zinc-500">Step 1 of 5: Blueprint Review Complete</span>
        <button
          onClick={() => {
            sessionStorage.setItem("ema_unlocked_core-audit", "true");
            navigate(`/projects/${id}/core-audit`);
          }}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] active:translate-x-0.5 active:translate-y-0.5 font-bold text-xs rounded-xs transition-all cursor-pointer"
        >
          <span>Proceed & Unlock Core Audit</span>
          <MoveRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      <StepRejectModal
        isOpen={!!rejectModalStepId}
        stepId={rejectModalStepId}
        stepFile={rejectModalFile}
        onClose={() => setRejectModalStepId(null)}
        onConfirmReject={(stepId, reason) => rejectMutation.mutate({ stepId, reason })}
        isSubmitting={rejectMutation.isPending}
      />

      <StepEditModal
        isOpen={!!editingStep}
        step={editingStep}
        onClose={() => setEditingStep(null)}
        onSaveEdit={(stepId, patch) => editMutation.mutate({ stepId, patch })}
        isSubmitting={editMutation.isPending}
      />

      <ConfirmBulkApproveModal
        isOpen={isConfirmBulkOpen}
        stepCount={sortedSteps.length}
        fileCount={uniqueFilesCount}
        onClose={() => setIsConfirmBulkOpen(false)}
        onConfirm={() => bulkApproveMutation.mutate()}
        isSubmitting={bulkApproveMutation.isPending}
      />
    </div>
  );
};
