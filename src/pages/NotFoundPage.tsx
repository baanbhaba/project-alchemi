import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Terminal, Undo2, LayoutDashboard, AlertTriangle, Sun, Moon } from "lucide-react";
import { useUiStore } from "../store/useUiStore";

const GLITCH_FRAMES = ["404", "4Ø4", "404", "4▓4", "404", "▓▓▓", "404"];

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleDarkMode } = useUiStore();
  const [glitch, setGlitch] = useState("404");
  const [frame, setFrame] = useState(0);
  const [typed, setTyped] = useState("");
  const fullText = `> ERROR: Route '${location.pathname}' does not exist in this execution context.`;

  // Sync dark mode class with documentElement
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Glitch animation on the 404
  useEffect(() => {
    let count = 0;
    const iv = setInterval(() => {
      setGlitch(GLITCH_FRAMES[count % GLITCH_FRAMES.length]);
      setFrame((f) => f + 1);
      count++;
      if (count >= GLITCH_FRAMES.length * 3) clearInterval(iv);
    }, 80);
    return () => clearInterval(iv);
  }, []);

  // Typewriter for the error line
  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      if (i <= fullText.length) {
        setTyped(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(iv);
      }
    }, 22);
    return () => clearInterval(iv);
  }, [fullText]);

  return (
    <div className="min-h-screen bg-[#fdf8f0] dark:bg-[#12161f] text-[#181c24] dark:text-[#f0f6fc] font-mono flex flex-col items-center justify-center p-6 select-none relative transition-colors">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleDarkMode}
          className="p-2.5 bg-[#fff8f6] dark:bg-[#161b22] border-2 border-[#181c24] dark:border-[#30363d] text-[#181c24] dark:text-[#f0f6fc] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? <Sun className="w-4 h-4 text-[#f59e0b]" /> : <Moon className="w-4 h-4 text-[#f59e0b]" />}
        </button>
      </div>

      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-40 dark:opacity-100"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
        }}
      />

      <div className="relative z-10 max-w-xl w-full space-y-8 text-center">
        {/* Big glitch number */}
        <div className="relative">
          <span
            className="text-[120px] md:text-[180px] font-extrabold leading-none tracking-tighter"
            style={{
              color: frame % 6 < 1 ? "#f59e0b" : isDarkMode ? "#f0f6fc" : "#181c24",
              textShadow:
                frame % 7 < 2
                  ? "3px 0 #f59e0b, -3px 0 #c2410c"
                  : isDarkMode
                  ? "2px 0 #f59e0b, -2px 0 #71717a"
                  : "2px 0 #f59e0b, -2px 0 #d4a017",
              transition: "text-shadow 0.05s, color 0.05s",
            }}
          >
            {glitch}
          </span>
          {/* Amber underline pulse */}
          <div className="h-1 bg-amber-500 rounded-full mt-2 mx-auto w-24 animate-pulse" />
        </div>

        {/* System error block */}
        <div className="bg-[#fff8f6] dark:bg-[#161b22] border-2 border-[#181c24] dark:border-[#30363d] shadow-[4px_4px_0px_#181c24] dark:shadow-[4px_4px_0px_#010409] rounded-lg p-5 text-left space-y-3 transition-colors">
          <div className="flex items-center space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest">
              ALCHEMI — Kernel Panic
            </span>
          </div>

          {/* Typewriter error line */}
          <div className="text-xs text-rose-600 dark:text-red-400 font-bold min-h-[1.5rem] break-all">
            {typed}
            <span className="animate-pulse">█</span>
          </div>

          <div className="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-300">stack:</span> NavigationError at Router.resolve()
            </div>
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-300">code:</span> ROUTE_NOT_FOUND (0x404)
            </div>
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-300">hint:</span> The requested pipeline view or resource
              was not registered in this deployment.
            </div>
          </div>
        </div>

        {/* Terminal-style trace */}
        <div className="bg-[#f8f5ee] dark:bg-[#0d1117] border-2 border-[#181c24] dark:border-[#30363d] shadow-[3px_3px_0px_#181c24] dark:shadow-[3px_3px_0px_#010409] rounded-lg p-4 text-left text-[11px] text-zinc-700 dark:text-zinc-400 space-y-1 transition-colors">
          <div className="flex items-center space-x-2 mb-2">
            <Terminal className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
            <span className="font-bold text-[#181c24] dark:text-zinc-200">alchemi-engine — shell</span>
          </div>
          <div>
            <span className="text-emerald-600 dark:text-green-500 font-bold">alchemi@prod</span>:<span className="text-blue-600 dark:text-blue-400">~</span>$ resolve{" "}
            <span className="text-amber-600 dark:text-amber-400 font-bold">{location.pathname}</span>
          </div>
          <div className="text-rose-600 dark:text-red-500 font-semibold">bash: {location.pathname}: No such route</div>
          <div>
            <span className="text-emerald-600 dark:text-green-500 font-bold">alchemi@prod</span>:<span className="text-blue-600 dark:text-blue-400">~</span>$ _
            <span className="animate-pulse">▌</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            id="notfound-go-back"
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] text-[#181c24] dark:text-zinc-200 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none group"
          >
            <Undo2 className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Go Back</span>
          </button>
          <button
            id="notfound-go-dashboard"
            onClick={() => navigate("/")}
            className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black border-2 border-[#181c24] dark:border-[#30363d] shadow-[2px_2px_0px_#181c24] dark:shadow-[2px_2px_0px_#010409] text-xs font-black rounded-lg transition-all duration-150 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none group"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>

        <p className="text-[10px] text-zinc-500 dark:text-zinc-600 font-sans">
          ALCHEMI Code Transformation Engine • Build {import.meta.env?.VITE_BUILD_ID || "dev"}
        </p>
      </div>
    </div>
  );
};
