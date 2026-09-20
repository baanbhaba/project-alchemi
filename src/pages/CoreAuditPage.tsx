import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ScanSearch, RadioTower, Microchip, Globe, FileTerminal, Check, MoveRight } from "lucide-react";
import { getCoreAudit, getProjectDetails } from "../api/client";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { TopologyGraph } from "../components/common/TopologyGraph";
import { LoadingSkeleton } from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorState";
import { getTransformedCode } from "../api/transform";

export const CoreAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"file" | "pattern">("file");

  const { data: projectDetails } = useQuery({
    queryKey: ["project-details", id],
    queryFn: () => getProjectDetails(id || ""),
    enabled: !!id,
  });

  const {
    data: audit,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["core-audit", id],
    queryFn: () => getCoreAudit(id || ""),
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
        phase="Core Architectural Audit"
        description="Extracting Java AST, detecting deprecated API patterns, and building static component topology."
      />
    );

  const blueprintSteps = projectDetails?.blueprint?.steps || [];
  const blueprintApprovedOrUnlocked =
    sessionStorage.getItem("ema_unlocked_core-audit") === "true" ||
    (blueprintSteps.length > 0 && blueprintSteps.some((s: any) => s.status === "approved"));

  if (projectDetails && !blueprintApprovedOrUnlocked) {
    return (
      <ErrorState
        title="Stage Locked"
        message="Blueprint Review must be approved or unlocked before access to Core Audit is granted."
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load Core Audit"
        message={error instanceof Error ? error.message : "Error fetching core audit"}
        onRetry={refetch}
      />
    );
  }
  if (!audit) return null;

  const filteredUsages = (audit.deprecated_usages || []).filter(
    (u) =>
      u.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.recommended_replacement.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedUsages = [...filteredUsages].sort((a, b) => {
    if (sortBy === "file") return a.file.localeCompare(b.file);
    return a.pattern.localeCompare(b.pattern);
  });

  return (
    <div className="space-y-6">
      {/* Header & Confidence Callout */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2 font-mono">
            <span>Core Architectural Audit</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-sans">
            Static analysis of detected tech stack, deprecated API signatures, and component dependency graphs.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-4 py-2.5 flex items-center space-x-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-zinc-400 block">
              Core Confidence
            </span>
            <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {Math.round(audit.confidence * 100)}%
            </span>
          </div>
          <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-mono font-bold">
            <Check className="w-4 h-4 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Architecture Summary */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <Microchip className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Architecture Summary</span>
          </div>
        }
      >
        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
          {audit.architecture_summary}
        </p>
      </Card>

      {/* Grid: Detected Stack & Dependency Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={
            <div className="flex items-center space-x-2">
              <FileTerminal className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Technology Stack</span>
            </div>
          }
          subtitle="Identified frameworks, libraries, and runtime dependencies"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2">Technology</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {audit.detected_stack.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.technology}</td>
                    <td className="px-3 py-2 text-zinc-500">{item.version}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title={
            <div className="flex items-center space-x-2">
              <Globe className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
              <span>Chained Architecture Topology Schema</span>
            </div>
          }
          subtitle="2D Flowchart & 3D Interactive Topology derived from source code & transformed Rust modules"
        >
          <div className="space-y-4">
            {audit.diagrams.map((diag, idx) => (
              <div key={idx}>
                <TopologyGraph
                  mermaidChart={diag.content}
                  id={`core-diag-${idx}`}
                  nodes={audit.dependency_graph?.nodes}
                  edges={audit.dependency_graph?.edges}
                  transformedCode={audit.rust_code || getTransformedCode(id || "")}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Deprecated Usages Section */}
      <Card
        title={
          <div className="flex items-center space-x-2">
            <RadioTower className="w-3.5 h-3.5 text-amber-500" />
            <span>Deprecated Usages ({audit.deprecated_usages.length})</span>
          </div>
        }
        subtitle="List of Java APIs requiring modernization"
      >
        <div className="space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative flex-1 max-w-md">
              <ScanSearch className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search file path, pattern, or replacement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center space-x-2 text-xs text-zinc-500">
              <span>Sort by:</span>
              <button
                onClick={() => setSortBy("file")}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  sortBy === "file"
                    ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                File
              </button>
              <button
                onClick={() => setSortBy("pattern")}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  sortBy === "pattern"
                    ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                Pattern
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2">File & Line</th>
                  <th className="px-3 py-2">Deprecated Pattern</th>
                  <th className="px-3 py-2">Rust Axum Replacement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {sortedUsages.length > 0 ? (
                  sortedUsages.map((usage, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                        {usage.file}:{usage.line}
                      </td>
                      <td className="px-3 py-2 text-amber-600 dark:text-amber-400">
                        {usage.pattern}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                        {usage.recommended_replacement}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-zinc-400">
                      No usages match filter "{searchQuery}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center font-mono">
        <span className="text-[10px] text-zinc-500">Step 2 of 5: Core Audit Complete</span>
        <button
          onClick={() => {
            sessionStorage.setItem("ema_unlocked_impact-audit", "true");
            navigate(`/projects/${id}/impact-audit`);
          }}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded font-bold text-xs transition-colors"
        >
          <span>Proceed & Unlock Impact Audit</span>
          <MoveRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
