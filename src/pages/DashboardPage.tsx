import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, MoveRight, GitFork, Clock, FolderGit, ServerCog, Code, Microchip, Trash2, Archive, Loader2 } from "lucide-react";
import { getProjects, createProject, deleteProject } from "../api/client";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { LoadingSkeleton } from "../components/common/LoadingSkeleton";
import { ErrorState } from "../components/common/ErrorState";
import { usePermissions } from "../lib/usePermissions";
import { FileTreeView } from "../components/common/FileTreeView";
import { extractZip, type ZipExtractionResult } from "../lib/zipExtractor";
import { SpotlightCard } from "../components/ui/SpotlightCard";
import { ShimmerButton } from "../components/ui/ShimmerButton";
import { MarqueeRibbon } from "../components/ui/MarqueeRibbon";
import { AnimatedNumber } from "../components/ui/AnimatedNumber";
import { GridPattern } from "../components/ui/GridPattern";

export const DashboardPage: React.FC = () => {
  const { can } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [javaCodeInput, setJavaCodeInput] = useState("");
  const [zipResult, setZipResult] = useState<ZipExtractionResult | null>(null);
  const [selectedZipFile, setSelectedZipFile] = useState<string | null>(null);
  const [isExtractingZip, setIsExtractingZip] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: projects,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsModalOpen(false);
      setNameInput("");
      setJavaCodeInput("");
      setZipResult(null);
      setSelectedZipFile(null);
      toast.success("Project created successfully");
      if (newProject?.id) {
        sessionStorage.setItem("ema_selected_project_id", newProject.id);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project removed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove project");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("Project name is required");
      return;
    }
    const sampleRepoUrl = "https://github.com/internal/" + nameInput.toLowerCase().replace(/\s+/g, "-");
    const code = zipResult?.combinedJavaCode || javaCodeInput.trim();
    createMutation.mutate({
      name: nameInput,
      repo_url: sampleRepoUrl,
      javaCode: code || undefined,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".zip")) {
      setIsExtractingZip(true);
      try {
        const result = await extractZip(file);
        setZipResult(result);
        setJavaCodeInput(result.combinedJavaCode);
        if (!nameInput) {
          const baseName = file.name.replace(/\.zip$/i, "");
          setNameInput(baseName.charAt(0).toUpperCase() + baseName.slice(1));
        }
        const firstJava = Object.keys(result.files).find((p) => p.endsWith(".java"));
        if (firstJava) {
          setSelectedZipFile(firstJava);
        }
        toast.success(`Extracted ${result.javaFileCount} Java files from ZIP`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to extract ZIP");
      } finally {
        setIsExtractingZip(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setJavaCodeInput(content);
        if (!nameInput) {
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          setNameInput(baseName.charAt(0).toUpperCase() + baseName.slice(1));
        }
        toast.success("Source code loaded");
      };
      reader.readAsText(file);
    }
  };

  const engineFeatures = [
    "Java OOP → Rust Axum",
    "AST Topology Analysis",
    "Blast Radius Verification",
    "Zero Memory Leaks",
    "High Throughput Async",
    "Automated Cargo.toml Generation",
    "Live NVIDIA 70B AI Engine"
  ];

  return (
    <div className="space-y-6 font-sans relative">
      <GridPattern />

      {/* Hero Header with Bold Editorial Typography & Shimmer CTA */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#181c24] dark:border-[#30363d] bg-white/80 dark:bg-[#161b22]/90 backdrop-blur-md p-6 sm:p-8 shadow-[4px_4px_0px_#181c24] dark:shadow-[4px_4px_0px_#010409]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>ALCHEMI TRANSFORMATION ENGINE V2.0</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Enterprise Migration Intelligence
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
              Automated legacy Java microservice refactoring, AST verification, and memory-safe Rust Axum synthesis.
            </p>
          </div>

          <ShimmerButton
            id="dashboard-new-project"
            onClick={() => setIsModalOpen(true)}
            className="shrink-0"
            aria-label="Upload a new Java project for migration analysis"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload New Project</span>
          </ShimmerButton>
        </div>

        {/* Live Metrics Ticker / Marquee Ribbon */}
        <div className="mt-6 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8">
          <MarqueeRibbon items={engineFeatures} />
        </div>
      </div>

      {/* Quick Pipeline Onboarding Guide for Users */}
      <div className="bg-white dark:bg-[#161b22] border-2 border-[#181c24] dark:border-[#30363d] shadow-[3px_3px_0px_#181c24] dark:shadow-[3px_3px_0px_#010409] p-4 rounded-xl">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center space-x-1.5">
            <span>Transformation Workflow</span>
          </span>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold font-mono">5-STAGE PIPELINE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-3 text-xs">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg space-y-1 hover:border-amber-500 transition-colors animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">1. Blueprint</div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Review & approve unit transformation steps.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg space-y-1 hover:border-amber-500 transition-colors animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">2. Core Audit</div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Inspect AST topology & dependency graphs.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg space-y-1 hover:border-amber-500 transition-colors animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">3. Impact Audit</div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Analyze breaking API changes & blast radius.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg space-y-1 hover:border-amber-500 transition-colors animate-slide-up stagger-4 opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">4. Readiness</div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Stakeholder sign-off & consensus vote.</p>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-lg space-y-1 hover:border-amber-500 transition-colors animate-slide-up stagger-5 opacity-0" style={{ animationFillMode: "forwards" }}>
            <div className="font-bold text-amber-600 dark:text-amber-400 font-mono">5. Report & Code</div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Export PDF audit report & compiled Rust source.</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <LoadingSkeleton
          rows={3}
          phase="Project Ingestion & Telemetry"
          description="Scanning Neon PostgreSQL repository records, AST uploads, and transformation readiness."
        />
      )}

      {isError && (
        <ErrorState
          title="Failed to load projects"
          message={error instanceof Error ? error.message : "Unknown error"}
          onRetry={refetch}
        />
      )}

      {!isLoading && !isError && projects && projects.length === 0 && (
        <div className="text-center py-16 flex flex-col items-center justify-center border-2 border-dashed border-[#181c24] dark:border-[#30363d] bg-white dark:bg-[#161b22] shadow-[3px_3px_0px_#181c24] dark:shadow-[3px_3px_0px_#010409] p-8 rounded-xl animate-fade-in">
          <div className="w-14 h-14 bg-amber-500/20 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] flex items-center justify-center mb-4 mx-auto rounded-lg">
            <FolderGit className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-[#181c24] dark:text-[#f0f6fc] mb-1">No Projects Found</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto mb-5 font-medium">
            Upload your legacy Java code or ZIP archive to launch automated Rust migration analysis.
          </p>
          <ShimmerButton
            id="dashboard-empty-new-project"
            onClick={() => setIsModalOpen(true)}
            className="mx-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Upload Project</span>
          </ShimmerButton>
        </div>
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
          }}
        >
          {projects.map((project) => (
            <motion.div
              key={project.id}
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.97 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 28 } },
              }}
            >
              <SpotlightCard
                className="border-2 border-[#181c24] dark:border-[#30363d] shadow-[3px_3px_0px_#181c24] dark:shadow-[3px_3px_0px_#010409] hover:shadow-[5px_5px_0px_#181c24] dark:hover:shadow-[5px_5px_0px_#010409] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
              >

              <div className="space-y-3 relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-500 text-black border-2 border-[#181c24] dark:border-[#30363d] flex items-center justify-center shadow-xs rounded-lg">
                      <ServerCog className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#181c24] dark:text-[#f0f6fc]">
                        {project.name}
                      </h3>
                      <div className="flex items-center space-x-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        <GitFork className="w-3 h-3 text-zinc-400" />
                        <span className="truncate max-w-[150px]">{project.repo_url}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (confirm(`Remove project "${project.name}"?`)) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-600 hover:text-white text-zinc-600 dark:text-zinc-400 border-2 border-[#181c24] dark:border-[#30363d] shadow-[1px_1px_0px_#181c24] dark:shadow-[1px_1px_0px_#010409] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer rounded-md"
                    title="Remove Project"
                    aria-label={`Remove project ${project.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t-2 border-zinc-100 dark:border-zinc-800 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Stage</span>
                    <Badge variant={project.stage} label={project.stage.replace("_", " ")} />
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="text-zinc-500 dark:text-zinc-400 text-[10px] uppercase font-bold block">Readiness</span>
                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/30 rounded-md font-mono">
                      <AnimatedNumber value={project.readiness_score || 92} /> / 100
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-2 border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                <div className="flex items-center space-x-1 text-[11px]">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  <span>{new Date(project.last_updated).toLocaleDateString()}</span>
                </div>

                <Link
                  to={`/projects/${project.id}/blueprint`}
                  onClick={() => sessionStorage.setItem("ema_selected_project_id", project.id)}
                  className="inline-flex items-center space-x-1.5 font-bold uppercase text-xs text-[#181c24] dark:text-[#f0f6fc] hover:text-amber-600 dark:hover:text-amber-400 transition-colors group"
                >
                  <span>Review Blueprint</span>
                  <MoveRight className="w-3.5 h-3.5 stroke-[2.5] group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      )}


      {/* Upload Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Java Code for Migration"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer rounded-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={createMutation.isPending}
              className="px-4 py-1.5 bg-amber-500 text-black text-xs font-bold uppercase border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 cursor-pointer rounded-xs"
            >
              {createMutation.isPending ? "Ingesting Java Code..." : "Start Migration Analysis"}
            </button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleCreate} className="space-y-4 text-xs font-sans">
          <div>
            <label className="block font-bold uppercase text-xs text-zinc-800 dark:text-zinc-200 mb-1">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. UserService REST API"
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none rounded-xs"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-xs text-zinc-800 dark:text-zinc-200 mb-1">
              Upload Java File or ZIP Archive
            </label>
            <input
              type="file"
              accept=".java,.txt,.xml,.zip"
              onChange={handleFileUpload}
              disabled={isExtractingZip}
              className="block w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-2 file:py-1 file:px-3 file:border-2 file:border-[#181c24] dark:file:border-[#30363d] file:text-xs file:font-bold file:bg-amber-500 file:text-black file:shadow-[1px_1px_0px_#181c24] file:cursor-pointer disabled:opacity-50 rounded-xs"
            />
            {isExtractingZip && (
              <div className="flex items-center space-x-2 mt-2 text-xs text-amber-600 dark:text-amber-400 font-bold font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting ZIP archive...</span>
              </div>
            )}
          </div>

          {/* ZIP File Tree Preview */}
          {zipResult && (
            <div className="border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] overflow-hidden rounded-xs">
              <div className="flex items-center justify-between px-3 py-2 bg-amber-500 text-black border-b-2 border-[#181c24] dark:border-[#30363d]">
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  <Archive className="w-3.5 h-3.5" />
                  <span>{zipResult.projectType.toUpperCase()} PROJECT</span>
                  <span>·</span>
                  <span>{zipResult.javaFileCount} Java files</span>
                </div>
                <span className="text-[10px] font-bold">
                  {Object.keys(zipResult.files).length} total files
                </span>
              </div>
              <div className="h-48 overflow-hidden bg-white dark:bg-zinc-900 font-mono">
                <FileTreeView
                  tree={zipResult.tree}
                  files={zipResult.files}
                  selectedPath={selectedZipFile ?? undefined}
                  onSelectFile={(path, content) => {
                    setSelectedZipFile(path);
                    setJavaCodeInput(content);
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold uppercase text-xs text-zinc-800 dark:text-zinc-200 mb-1 flex items-center space-x-1">
              <Code className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Java Source Code</span>
            </label>
            <textarea
              rows={6}
              value={javaCodeInput}
              onChange={(e) => setJavaCodeInput(e.target.value)}
              placeholder="public class UserController { ... }"
              className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none whitespace-pre rounded-xs"
            />
          </div>

          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] text-zinc-800 dark:text-zinc-200 space-y-1 rounded-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-amber-700 dark:text-amber-400">
                <Microchip className="w-3.5 h-3.5" />
                <span>Target Engine: Java OOP → Rust Axum</span>
              </div>
              {can("use_live_ai_engine") && (
                <span className="text-[10px] bg-amber-500 text-black font-bold px-2 py-0.5 rounded-xs">
                  LIVE ENGINE ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              AST parser extracts symbols and validates type transformations across the pipeline.
            </p>
          </div>
        </form>
      </Modal>
    </div>
  );
};
