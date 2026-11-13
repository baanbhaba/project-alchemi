import React, { useState, useEffect } from "react";
import { NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorPlay, FileScan, Bolt, SquareCheckBig, GitPullRequestArrow, ScanText, SlidersHorizontal, CircuitBoard, Cable, FolderGit, ChevronDown, CloudDownload, FileTerminal, RefreshCcw, Sparkles, Lock, User } from "lucide-react";
import { getProjects, getBlueprint, getProjectDetails } from "../../api/client";
import { useUiStore } from "../../store/useUiStore";
import { downloadCombinedRustProject, downloadCargoToml } from "../../utils/exportRustCode";
import { logger } from "../../lib/logger";
import { useAuthStore } from "../../store/useAuthStore";
import { usePermissions } from "../../lib/usePermissions";

export const Sidebar: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);
  const { username } = useAuthStore();
  const { role } = usePermissions();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const activeProjects = projects && projects.length > 0 ? projects : [];
  const savedProjectId = sessionStorage.getItem("ema_selected_project_id");
  const selectedProjectId = id || savedProjectId || (activeProjects[0] ? activeProjects[0].id : "proj-payment-gateway");
  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId) || activeProjects[0];

  useEffect(() => {
    if (id) {
      sessionStorage.setItem("ema_selected_project_id", id);
    }
  }, [id]);

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = e.target.value;
    if (targetId) {
      sessionStorage.setItem("ema_selected_project_id", targetId);
      let subPage = "blueprint";
      if (location.pathname.includes("/core-audit")) subPage = "core-audit";
      else if (location.pathname.includes("/impact-audit")) subPage = "impact-audit";
      else if (location.pathname.includes("/readiness")) subPage = "readiness";
      else if (location.pathname.includes("/blueprint")) subPage = "blueprint";
      else if (location.pathname.includes("/report")) subPage = "report";

      navigate(`/projects/${targetId}/${subPage}`);
    }
  };

  const handleDownloadRustCode = async () => {
    setIsExporting(true);
    try {
      const blueprint = await getBlueprint(selectedProjectId);
      downloadCombinedRustProject(selectedProjectId, selectedProject?.name || selectedProjectId, blueprint.steps || []);
    } catch (err) {
      logger.warn("sidebar", "Failed to download Rust code; fallback export.", {}, err as Error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCargoToml = () => {
    downloadCargoToml(selectedProject?.name || selectedProjectId);
  };

  const handleResyncAnalysis = () => {
    queryClient.invalidateQueries({ queryKey: ["blueprint", selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ["core-audit", selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ["impact-audit", selectedProjectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const { data: _projectDetails } = useQuery({
    queryKey: ["project-details", selectedProjectId],
    queryFn: () => getProjectDetails(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  const isRouteUnlocked = (_label: string): boolean => {
    return true;
  };

  const navItems = [
    {
      label: "Blueprint Review",
      path: `/projects/${selectedProjectId}/blueprint`,
      icon: GitPullRequestArrow,
    },
    {
      label: "Core Audit",
      path: `/projects/${selectedProjectId}/core-audit`,
      icon: FileScan,
    },
    {
      label: "Impact Audit",
      path: `/projects/${selectedProjectId}/impact-audit`,
      icon: Bolt,
    },
    {
      label: "Readiness & Consensus",
      path: `/projects/${selectedProjectId}/readiness`,
      icon: SquareCheckBig,
    },
    {
      label: "Migration Report",
      path: `/projects/${selectedProjectId}/report`,
      icon: ScanText,
    },
  ];

  const enterpriseItems = [
    { label: "Settings", path: "/settings", icon: SlidersHorizontal },
    { label: "Account", path: "/account", icon: CircuitBoard },
    { label: "Integrations", path: "/integrations", icon: Cable },
    { label: "Privacy & Security", path: "/privacy-security", icon: Lock },
  ];

  return (
    <aside className="w-60 bg-[#ffffff] dark:bg-[#161b22] border-r-2 border-[#181c24] dark:border-[#30363d] flex flex-col justify-between shrink-0 min-h-[calc(100vh-3.5rem)] font-sans text-xs hidden md:flex transition-colors text-[#181c24] dark:text-[#f0f6fc]">
      <div className="space-y-3">
        {/* Project Selector & Overview Header */}
        <div className="p-3 border-b-2 border-[#181c24] dark:border-[#30363d] space-y-2.5">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3 py-2 border-2 border-[#181c24] dark:border-[#30363d] rounded-xs transition-all font-bold ${
                isActive && !id
                  ? "bg-amber-500 text-black shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409]"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`
            }
          >
            <MonitorPlay className="w-4 h-4 text-zinc-900 dark:text-amber-400 shrink-0" />
            <span className="tracking-wide">Dashboard</span>
          </NavLink>

          {/* Active Project Switcher Dropdown */}
          <div className="bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] p-2.5 space-y-1.5 shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409]">
            <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 uppercase font-bold tracking-wider">
              <span>Active Project</span>
              <FolderGit className="w-3.5 h-3.5 text-amber-500" />
            </div>

            <div className="relative group">
              <select
                value={selectedProjectId}
                onChange={handleProjectSelect}
                className="w-full bg-white dark:bg-zinc-800 border-2 border-[#181c24] dark:border-[#30363d] px-2 py-1.5 text-xs text-[#181c24] dark:text-[#f0f6fc] font-medium focus:outline-none appearance-none cursor-pointer pr-6 shadow-xs"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-white dark:bg-zinc-800 text-[#181c24] dark:text-[#f0f6fc]">
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500 absolute right-2 top-2.5 pointer-events-none" />
            </div>
            {selectedProject && (
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate pt-0.5 flex items-center justify-between font-semibold">
                <span>Stage</span>
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-500/40 text-[10px] uppercase font-bold rounded-xs">
                  {selectedProject.stage.replace("_", " ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Streamlined Project Navigation Menu */}
        <div className="px-2.5 space-y-1">
          <div className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>Analysis Pipeline</span>
          </div>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const unlocked = isRouteUnlocked(item.label);
            const { addNotification } = useUiStore.getState();

            if (!unlocked) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() =>
                    addNotification(
                      `Stage Locked: Complete previous pipeline views: 1. Blueprint Review -> 2. Core Audit -> 3. Impact Audit -> 4. Readiness -> 5. Migration Report.`,
                      "warning"
                    )
                  }
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed text-left text-xs border border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold opacity-60">{index + 1}.</span>
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-40" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <Lock className="w-3 h-3 shrink-0" />
                </button>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-2.5 py-2 border-2 transition-all font-semibold rounded-xs ${
                    isActive
                      ? "bg-amber-500 text-black border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409]"
                      : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-[#181c24] dark:hover:border-[#30363d] hover:text-[#181c24] dark:hover:text-white hover:shadow-[2px_2px_0px_#181c24] dark:hover:shadow-[2px_2px_0px_#010409]"
                  }`
                }
              >
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{index + 1}.</span>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Export & Download Quick Utilities */}
        <div className="px-2.5 pt-2 border-t-2 border-[#181c24] dark:border-[#30363d] space-y-1.5">
          <div className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>Exports & Code</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          <button
            type="button"
            onClick={handleDownloadRustCode}
            disabled={isExporting}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] hover:bg-amber-500 hover:text-black dark:hover:bg-amber-500 dark:hover:text-black text-zinc-800 dark:text-zinc-200 font-bold text-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            title="Download complete Rust Axum migrated source code"
          >
            <FileTerminal className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">Download Rust (.rs)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCargoToml}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] hover:bg-amber-500 hover:text-black dark:hover:bg-amber-500 dark:hover:text-black text-zinc-800 dark:text-zinc-200 font-bold text-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            title="Download Cargo.toml dependencies file"
          >
            <CloudDownload className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">Download Cargo.toml</span>
          </button>

          <button
            type="button"
            onClick={handleResyncAnalysis}
            className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white text-zinc-800 dark:text-zinc-200 font-bold text-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            title="Refresh analysis cache"
          >
            <RefreshCcw className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">Re-Sync Analysis</span>
          </button>
        </div>
      </div>

      {/* Settings & Admin Bottom Links */}
      <div>
        <div className="p-2.5 border-t-2 border-[#181c24] dark:border-[#30363d] space-y-1">
          <div className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Settings & Admin
          </div>
          {enterpriseItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-2.5 py-1.5 border-2 transition-all font-semibold rounded-xs ${
                    isActive
                      ? "bg-amber-500 text-black border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409]"
                      : "border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-[#181c24] dark:hover:border-[#30363d] hover:text-[#181c24] dark:hover:text-white hover:shadow-[2px_2px_0px_#181c24] dark:hover:shadow-[2px_2px_0px_#010409]"
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* User Profile Mini-card */}
        <div className="p-3 border-t-2 border-[#181c24] dark:border-[#30363d] bg-zinc-50 dark:bg-zinc-900">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 bg-amber-500 text-black border-2 border-[#181c24] dark:border-[#30363d] shadow-xs flex items-center justify-center shrink-0 font-bold">
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#181c24] dark:text-[#f0f6fc] truncate">
                {username || "Guest"}
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-bold tracking-wide truncate">
                  {role ? role.replace('_', ' ') : "Viewer"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

