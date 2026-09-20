import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bolt, Database, Sliders, TriangleAlert, ChevronDown, ChevronRight, Layers, ScanText, MoveRight } from "lucide-react";
import { getImpactAudit, getProjectDetails } from "../api/client";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { LoadingSkeleton } from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorState";

export const ImpactAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [expandedBlastIndex, setExpandedBlastIndex] = useState<number | null>(null);

  const { data: projectDetails } = useQuery({
    queryKey: ["project-details", id],
    queryFn: () => getProjectDetails(id || ""),
    enabled: !!id,
  });

  const {
    data: impact,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["impact-audit", id],
    queryFn: () => getImpactAudit(id || ""),
    enabled: !!id,
  });

  useEffect(() => {
    if (isError && error && (error as any).status === 404) {
      navigate("/404", { replace: true });
    }
  }, [isError, error, navigate]);

  if (isLoading)
    return (
      <LoadingSkeleton
        phase="Impact & Blast Radius Analysis"
        description="Assessing database migrations, breaking changes, API consumers, and operational risk factors."
      />
    );

  const coreDone = !!projectDetails?.core_audit || sessionStorage.getItem("ema_unlocked_impact-audit") === "true";
  if (projectDetails && !coreDone) {
    return (
      <ErrorState
        title="Stage Locked"
        message="Core Audit must be executed before access to Impact Audit is granted."
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load Impact Audit"
        message={error instanceof Error ? error.message : "Error fetching impact audit"}
        onRetry={refetch}
      />
    );
  }
  if (!impact) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 font-mono">
            <span>Impact & Blast Radius Audit</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Evaluates breaking change exposure across public API interfaces, database schema dialects, configurations, and third-party libraries.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-4 py-2.5 flex items-center space-x-3 shrink-0 font-mono">
          <div className="text-right">
            <span className="text-[10px] uppercase text-zinc-400 block">
              Impact Confidence
            </span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {Math.round(impact.confidence * 100)}%
            </span>
          </div>
          <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-bold">
            <Bolt className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 1. API Surface Table */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <Layers className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Public API Surface Risk</span>
          </div>
        }
        subtitle="Downstream clients and breaking change risk levels"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2">Endpoint / Interface</th>
                <th className="px-3 py-2">Consumers</th>
                <th className="px-3 py-2 text-right">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {impact.api_surface.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.endpoint_or_interface}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {item.consumers.map((c, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant={item.breaking_change_risk} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2. Database & Config Impacts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={
            <div className="flex items-center space-x-2">
              <Database className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Database Schema & Driver Impacts</span>
            </div>
          }
        >
          <div className="space-y-2">
            {impact.database_impacts.length > 0 ? (
              impact.database_impacts.map((db, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {db.component || db.file || "Database Layer"}
                    </span>
                    <Badge variant={db.risk} />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">{db.notes}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400 italic">No database impacts detected.</p>
            )}
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Configuration Impacts</span>
            </div>
          }
        >
          <div className="space-y-2">
            {impact.config_impacts.length > 0 ? (
              impact.config_impacts.map((cfg, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {cfg.component || cfg.file || "Config Layer"}
                    </span>
                    <Badge variant={cfg.risk} />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-sans leading-relaxed">{cfg.notes}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-zinc-400 italic">No config impacts detected.</p>
            )}
          </div>
        </Card>
      </div>

      {/* 3. Dependency Risks Table */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Dependency Upgrade Risks</span>
          </div>
        }
        subtitle="Identified risks and mitigation strategies"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[10px] text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2">Dependency</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Mitigation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {impact.dependency_risks.map((dep, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                    {dep.dependency || dep.library || "Unknown Dependency"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={(dep.risk as "low" | "medium" | "high") || "low"} />
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 max-w-sm truncate whitespace-normal">
                    {dep.mitigation || (dep.known_breaking_changes ? dep.known_breaking_changes.join(", ") : "Manual review required")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {impact.dependency_risks.length === 0 && (
            <p className="text-xs text-zinc-400 italic p-4 text-center">No significant dependency risks found.</p>
          )}
        </div>
      </Card>

      {/* 4. Blast Radius Section */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <Bolt className="w-3.5 h-3.5 text-amber-500" />
            <span>Blast Radius Summary</span>
          </div>
        }
        subtitle="Expand flagged architectural changes to view affected source files"
      >
        <div className="space-y-2 font-mono">
          {impact.blast_radius.map((blast, idx) => {
            const isExpanded = expandedBlastIndex === idx;
            return (
              <div
                key={idx}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded p-3"
              >
                <div
                  onClick={() => setExpandedBlastIndex(isExpanded ? null : idx)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Badge variant={blast.severity} />
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{blast.change}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-zinc-500 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
                      {blast.affected_files.length} files
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                      Affected Manifest:
                    </span>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                      {blast.affected_files.map((file, fIdx) => (
                        <div key={fIdx} className="flex items-center space-x-1.5 text-zinc-700 dark:text-zinc-300">
                          <ScanText className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span>{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-mono">
        <span className="text-[10px] text-zinc-500">Step 3 of 5: Impact Audit Complete</span>
        <button
          onClick={() => {
            sessionStorage.setItem("ema_unlocked_readiness", "true");
            navigate(`/projects/${id}/readiness`);
          }}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded font-bold text-xs transition-colors"
        >
          <span>Proceed & Unlock Readiness & Consensus</span>
          <MoveRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
