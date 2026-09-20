import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw, CircleCheckBig, HelpCircle, BarChart3, Layers, Scale, MoveRight } from "lucide-react";
import { getReadinessScore, getConsensusResult, getProjectDetails } from "../api/client";
import { Card } from "../components/common/Card";
import { LoadingSkeleton } from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorState";

const DIMENSION_METADATA: Record<
  string,
  { label: string; weight: number; description: string }
> = {
  architecture_understanding: {
    label: "Architecture Understanding",
    weight: 20,
    description: "Accuracy of static codebase topology scan",
  },
  migration_feasibility: {
    label: "Migration Feasibility",
    weight: 20,
    description: "Automated patch generation viability",
  },
  dependency_resolution: {
    label: "Dependency Resolution",
    weight: 15,
    description: "Compatibility of target library upgrades",
  },
  api_compatibility: {
    label: "API Surface Compatibility",
    weight: 15,
    description: "Downstream client breaking contract risk",
  },
  breaking_change_risk: {
    label: "Breaking Change Risk",
    weight: 15,
    description: "Inverted scale (higher score = safer migration)",
  },
  configuration_completeness: {
    label: "Configuration Completeness",
    weight: 10,
    description: "Spring Boot & environment mapping",
  },
  rollback_availability: {
    label: "Rollback Availability",
    weight: 5,
    description: "Automated downgrade script readiness",
  },
};

export const ReadinessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: projectDetails } = useQuery({
    queryKey: ["project-details", id],
    queryFn: () => getProjectDetails(id || ""),
    enabled: !!id,
  });

  const {
    data: scoreData,
    isLoading: isLoadingScore,
    isError: isErrorScore,
    error: errorScore,
    refetch: refetchScore,
  } = useQuery({
    queryKey: ["readiness-score", id],
    queryFn: () => getReadinessScore(id || ""),
    enabled: !!id,
  });

  const {
    data: consensusData,
    isLoading: isLoadingConsensus,
    isError: isErrorConsensus,
    error: errorConsensus,
    refetch: refetchConsensus,
  } = useQuery({
    queryKey: ["consensus-result", id],
    queryFn: () => getConsensusResult(id || ""),
    enabled: !!id,
  });

  useEffect(() => {
    const errObj = errorScore || errorConsensus;
    if ((isErrorScore || isErrorConsensus) && errObj && (errObj as any).status === 404) {
      navigate("/404", { replace: true });
    }
  }, [isErrorScore, isErrorConsensus, errorScore, errorConsensus, navigate]);

  if (isLoadingScore || isLoadingConsensus)
    return (
      <LoadingSkeleton
        phase="Readiness & Multi-Agent Consensus"
        description="Aggregating dimension scores, weightings, and gate validation criteria across Core and Impact agents."
      />
    );

  const prevDone = (!!projectDetails?.core_audit && !!projectDetails?.impact_audit) || sessionStorage.getItem("ema_unlocked_readiness") === "true";
  if (projectDetails && !prevDone) {
    return (
      <ErrorState
        title="Stage Locked"
        message="Core Audit and Impact Audit must be executed before access to Readiness & Consensus is granted."
      />
    );
  }

  if (isErrorScore || isErrorConsensus) {
    return (
      <ErrorState
        title="Failed to load Readiness Metrics"
        message={
          (errorScore instanceof Error ? errorScore.message : "") ||
          (errorConsensus instanceof Error ? errorConsensus.message : "")
        }
        onRetry={() => {
          refetchScore();
          refetchConsensus();
        }}
      />
    );
  }

  if (!scoreData || !consensusData) return null;

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <span>Readiness Score & Consensus Engine</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-sans">
            Reconciles Core Analysis and Impact Analysis agent positions into a 7-dimension index.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-4 py-2.5 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase text-zinc-400 block">Overall Score</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {scoreData.overall} / 100
            </span>
          </div>
          <div className="w-10 h-10 rounded border-2 border-amber-500/40 bg-amber-500/10 flex items-center justify-center font-bold text-amber-500 text-sm">
            {scoreData.overall}%
          </div>
        </div>
      </div>

      {consensusData.should_iterate_again && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-600 dark:text-amber-400 flex items-center space-x-2 text-xs">
          <RefreshCcw className="w-4 h-4 text-amber-500 animate-spin shrink-0" />
          <span>
            <strong>Analysis Iteration Active:</strong> Unresolved agent conflicts detected. Engine re-evaluating migration steps.
          </span>
        </div>
      )}

      {/* 7 Weighted Dimensions */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Weighted Score Breakdown (7 Dimensions)</span>
          </div>
        }
        subtitle="Individual metric performance across 7 architectural dimensions"
      >
        <div className="space-y-3 font-mono">
          {Object.entries(scoreData.breakdown).map(([key, val]) => {
            const meta = DIMENSION_METADATA[key] || {
              label: key,
              weight: 0,
              description: "",
            };

            return (
              <div key={key} className="space-y-1 p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{meta.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      Weight: {meta.weight}%
                    </span>
                  </div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{val} / 100</span>
                </div>

                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded transition-all duration-300"
                    style={{ width: `${val}%` }}
                  ></div>
                </div>

                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans">{meta.description}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Agent Conflict Resolution List */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <Scale className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Agent Position Conflicts</span>
          </div>
        }
        subtitle="Side-by-side breakdown of Core vs Impact agent positions"
      >
        <div className="space-y-3 font-mono">
          {consensusData.conflicts.length > 0 ? (
            consensusData.conflicts.map((conflict, idx) => (
              <div
                key={idx}
                className="p-4 rounded border bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{conflict.topic}</span>
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      conflict.resolved
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    }`}
                  >
                    {conflict.resolved ? "RESOLVED" : "UNRESOLVED CONFLICT"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded space-y-1">
                    <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center space-x-1">
                      <Layers className="w-3 h-3" />
                      <span>Core Agent Position</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed">{conflict.core_position}</p>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded space-y-1">
                    <div className="text-[10px] uppercase font-bold text-zinc-400 flex items-center space-x-1">
                      <Scale className="w-3 h-3" />
                      <span>Impact Agent Position</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 font-sans leading-relaxed">{conflict.impact_position}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-zinc-400 text-xs bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800">
              <CircleCheckBig className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
              <span>Full consensus achieved on iteration #1. Zero conflicts detected.</span>
            </div>
          )}
        </div>
      </Card>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-mono">
        <span className="text-[10px] text-zinc-500">Step 4 of 5: Consensus Achieved</span>
        <button
          onClick={() => {
            sessionStorage.setItem("ema_unlocked_report", "true");
            navigate(`/projects/${id}/report`);
          }}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded font-bold text-xs transition-colors"
        >
          <span>Proceed & Unlock Migration Report</span>
          <MoveRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
