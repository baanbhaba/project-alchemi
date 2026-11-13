import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, MonitorPlay, Layers, Bolt, BarChart3, GitPullRequest, FileCheck2, SlidersHorizontal, CircuitBoard, Cable, Sun, Moon, BadgeCheck, LogOut, ChevronDown, FolderGit, CloudDownload, FileTerminal, RefreshCcw, Sparkles, Lock } from "lucide-react";
import { useUiStore } from "../../store/useUiStore";
import { useAuthStore } from "../../store/useAuthStore";
import { getProjects, getBlueprint, getProjectDetails } from "../../api/client";
import { downloadCombinedRustProject, downloadCargoToml } from "../../utils/exportRustCode";

export const HamburgerDrawer: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isHamburgerOpen, setHamburgerOpen, isDarkMode, toggleDarkMode } = useUiStore();
  const { logout, username } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const match = location.pathname.match(/\/projects\/([^/]+)/);
  const activeProjects = projects && projects.length > 0 ? projects : [];
  const savedProjectId = sessionStorage.getItem("ema_selected_project_id");
  const selectedProjectId = (match ? match[1] : savedProjectId) || (activeProjects[0] ? activeProjects[0].id : "proj-payment-gateway");
  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId) || activeProjects[0];

  const { data: _projectDetails } = useQuery({
    queryKey: ["project-details", selectedProjectId],
    queryFn: () => getProjectDetails(selectedProjectId),
    enabled: !!selectedProjectId,
  });

  if (!isHamburgerOpen) return null;

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
      setHamburgerOpen(false);
    }
  };

  const handleDownloadRustCode = async () => {
    setIsExporting(true);
    try {
      const blueprint = await getBlueprint(selectedProjectId);
      downloadCombinedRustProject(selectedProjectId, selectedProject?.name || selectedProjectId, blueprint.steps || []);
    } catch {
      console.warn("Failed to download Rust code; fallback export.");
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


  const isRouteUnlocked = (_label: string): boolean => {
    return true;
  };

  const projectNavItems = [
    { label: "Blueprint Review", path: `/projects/${selectedProjectId}/blueprint`, icon: GitPullRequest },
    { label: "Core Audit", path: `/projects/${selectedProjectId}/core-audit`, icon: Layers },
    { label: "Impact & Blast Radius", path: `/projects/${selectedProjectId}/impact-audit`, icon: Bolt },
    { label: "Readiness & Consensus", path: `/projects/${selectedProjectId}/readiness`, icon: BarChart3 },
    { label: "Migration Report", path: `/projects/${selectedProjectId}/report`, icon: FileCheck2 },
  ];

  const primaryNavItems = [
    { label: "Dashboard", path: "/", icon: MonitorPlay },
    { label: "Settings", path: "/settings", icon: SlidersHorizontal },
    { label: "Account", path: "/account", icon: CircuitBoard },
    { label: "Integrations", path: "/integrations", icon: Cable },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-mono">
      <div
        className="fixed inset-0 bg-[#231917]/70 backdrop-blur-xs transition-opacity"
        onClick={() => setHamburgerOpen(false)}
      ></div>

      <div className="relative w-full max-w-sm bg-[#fdf8f0] dark:bg-[#181211] text-[#231917] dark:text-[#fdf8f0] border-l-2 border-[#231917] dark:border-[#f4a300] h-full flex flex-col justify-between z-10 shadow-[6px_0px_0px_#231917] p-5 overflow-y-auto transition-colors">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b-2 border-[#231917] dark:border-[#f4a300]">
            <div className="flex items-center space-x-2">
              <div className="p-1 bg-[#f4a300] border-2 border-[#231917] shadow-[2px_2px_0px_#231917]">
                <img src="/cpu.png" alt="ALCHEMI Logo" className="w-5 h-5 object-cover" />
              </div>
              <span className="font-display text-lg text-[#231917] dark:text-[#fdf8f0] tracking-wider">
                NAVIGATION MENU
              </span>
            </div>

            <button
              onClick={() => setHamburgerOpen(false)}
              className="p-1.5 bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-[#231917] dark:text-[#fdf8f0]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] p-3 space-y-2 shadow-[3px_3px_0px_#231917]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#5c4a45] dark:text-[#dcc0ba] uppercase text-[10px] font-black tracking-wider">
                THEME MODE
              </span>
              <span className="text-[#f4a300] text-[11px] font-black bg-[#231917] dark:bg-[#f4a300] dark:text-[#231917] px-1.5 py-0.5 border border-[#231917]">
                {isDarkMode ? "DARK WARM" : "WARM CREAM"}
              </span>
            </div>

            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between p-2 bg-[#fdf8f0] dark:bg-[#181211] border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917] hover:bg-[#f4a300] hover:text-[#231917] transition-all text-xs font-bold"
            >
              <div className="flex items-center space-x-2">
                {isDarkMode ? (
                  <Moon className="w-4 h-4 text-[#f4a300]" />
                ) : (
                  <Sun className="w-4 h-4 text-[#f4a300]" />
                )}
                <span>{isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-[#f4a300] text-[#231917] border border-[#231917] font-black">
                TOGGLE
              </span>
            </button>
          </div>

          {/* Active Project Selector */}
          <div className="bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] p-3 space-y-2 shadow-[3px_3px_0px_#231917]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9b3f27] dark:text-[#f4a300] uppercase text-[10px] font-black tracking-wider flex items-center space-x-1">
                <FolderGit className="w-3.5 h-3.5" />
                <span>Active Project</span>
              </span>
            </div>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={handleProjectSelect}
                className="w-full bg-[#fdf8f0] dark:bg-[#181211] border-2 border-[#231917] dark:border-[#f4a300] px-2.5 py-1.5 text-xs text-[#231917] dark:text-[#fdf8f0] font-mono font-bold focus:outline-none appearance-none cursor-pointer pr-6 shadow-[1px_1px_0px_#231917]"
              >
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#fdf8f0] dark:bg-[#231917] text-[#231917] dark:text-[#fdf8f0]">
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#231917] dark:text-[#f4a300] absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Streamlined Project Pipeline Menu */}
          <div className="space-y-1">
            <span className="text-[10px] text-[#9b3f27] dark:text-[#f4a300] uppercase tracking-widest block px-2 mb-1 font-black">
              Analysis Pipeline
            </span>
            {projectNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const unlocked = isRouteUnlocked(item.label);
              const { addNotification } = useUiStore.getState();

              if (!unlocked) {
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() =>
                      addNotification(
                        `Stage Locked: Complete previous pipeline views: 1. Blueprint Review -> 2. Core Audit -> 3. Impact Audit -> 4. Readiness & Consensus -> 5. Migration Report.`,
                        "warning"
                      )
                    }
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#88726c] dark:text-[#5c4a45] opacity-60 cursor-not-allowed text-left font-mono border border-dashed border-[#88726c]/40 bg-transparent"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className="w-4 h-4 shrink-0 opacity-40" />
                      <span>{item.label}</span>
                    </div>
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                  </button>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setHamburgerOpen(false)}
                  className={`flex items-center space-x-2.5 px-3 py-2 border-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#f4a300] text-[#231917] border-[#231917] shadow-[2px_2px_0px_#231917]"
                      : "border-transparent text-[#231917] dark:text-[#fdf8f0] hover:bg-[#fff8f6] dark:hover:bg-[#231917] hover:border-[#231917] hover:shadow-[2px_2px_0px_#231917]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#9b3f27] dark:text-[#f4a300]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Sidebar Downloads & Code Utilities */}
          <div className="space-y-1.5 pt-3 border-t-2 border-[#231917] dark:border-[#f4a300]">
            <span className="text-[10px] text-[#9b3f27] dark:text-[#f4a300] uppercase tracking-widest block px-2 mb-1 font-black flex items-center justify-between">
              <span>Exports & Downloads</span>
              <Sparkles className="w-3.5 h-3.5 text-[#f4a300]" />
            </span>

            <button
              type="button"
              onClick={handleDownloadRustCode}
              disabled={isExporting}
              className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-[#231917] dark:text-[#fdf8f0] bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917] hover:bg-[#f4a300] hover:text-[#231917] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            >
              <FileTerminal className="w-4 h-4 shrink-0 text-[#9b3f27] dark:text-[#f4a300]" />
              <span>Download Rust Code (.rs)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCargoToml}
              className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-[#231917] dark:text-[#fdf8f0] bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917] hover:bg-[#d4a017] hover:text-[#231917] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            >
              <CloudDownload className="w-4 h-4 shrink-0 text-[#9b3f27] dark:text-[#f4a300]" />
              <span>Download Cargo.toml</span>
            </button>

            <button
              type="button"
              onClick={handleResyncAnalysis}
              className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-bold text-[#231917] dark:text-[#fdf8f0] bg-[#fff8f6] dark:bg-[#231917] border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917] hover:bg-[#a43152] hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-left"
            >
              <RefreshCcw className="w-4 h-4 shrink-0 text-[#9b3f27] dark:text-[#f4a300]" />
              <span>Re-Sync Analysis</span>
            </button>
          </div>

          {/* Global Enterprise Nav */}
          <div className="space-y-1 pt-3 border-t-2 border-[#231917] dark:border-[#f4a300]">
            <span className="text-[10px] text-[#9b3f27] dark:text-[#f4a300] uppercase tracking-widest block px-2 mb-1 font-black">
              Settings & Admin
            </span>
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setHamburgerOpen(false)}
                  className={`flex items-center space-x-2.5 px-3 py-2 border-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#f4a300] text-[#231917] border-[#231917] shadow-[2px_2px_0px_#231917]"
                      : "border-transparent text-[#231917] dark:text-[#fdf8f0] hover:bg-[#fff8f6] dark:hover:bg-[#231917] hover:border-[#231917] hover:shadow-[2px_2px_0px_#231917]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 text-[#9b3f27] dark:text-[#f4a300]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Footer */}
        <div className="pt-4 border-t-2 border-[#231917] dark:border-[#f4a300] space-y-3">
          <div className="flex items-center justify-between bg-[#fff8f6] dark:bg-[#231917] p-2.5 border-2 border-[#231917] dark:border-[#f4a300] shadow-[2px_2px_0px_#231917]">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-[#f4a300] border-2 border-[#231917] flex items-center justify-center font-bold text-[#231917] text-xs">
                {username ? username.substring(0, 2).toUpperCase() : "AD"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-[#231917] dark:text-[#fdf8f0] block truncate">
                  {username || "admin"}
                </span>
                <div className="flex items-center space-x-1 text-[10px] text-[#5c4a45] dark:text-[#dcc0ba]">
                  <BadgeCheck className="w-3 h-3 text-[#f4a300] shrink-0" />
                  <span>Engine Active</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                setHamburgerOpen(false);
              }}
              className="p-1.5 bg-[#a43152] text-white border-2 border-[#231917] shadow-[2px_2px_0px_#231917] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#5c4a45] dark:text-[#dcc0ba] text-center font-bold">
            ALCHEMI Pipeline • Java → Rust Transformation Engine
          </p>
        </div>
      </div>
    </div>
  );
};
