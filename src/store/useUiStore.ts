import { create } from "zustand";
import { updateUserPreference } from "../lib/userPreferences";

export interface ToastNotification {
  id: string;
  message: string;
  type: "info" | "warning" | "success";
}

interface UiState {
  // Theme & Drawers
  isDarkMode: boolean;
  isHamburgerOpen: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  toggleHamburger: () => void;
  setHamburgerOpen: (isOpen: boolean) => void;

  // Blueprint Inspection tracking per project
  viewedSteps: Record<string, string[]>;
  expandedSteps: string[];
  markStepViewed: (projectId: string, stepId: string) => void;
  markAllStepsViewed: (projectId: string, stepIds: string[]) => void;
  toggleStepExpanded: (stepId: string) => void;
  expandAllSteps: (stepIds: string[]) => void;
  collapseAllSteps: () => void;

  // Simulation Toggles
  isSimulatingApiError: boolean;
  toggleSimulateApiError: () => void;

  // Notification / Toast System
  notifications: ToastNotification[];
  addNotification: (message: string, type?: "info" | "warning" | "success") => void;
  removeNotification: (id: string) => void;
  notifyBackendRequired: (featureName: string) => void;
}

const getInitialDarkMode = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("ema_theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // ignore storage access errors
  }
  return false; // Light theme is default everywhere
};

export const useUiStore = create<UiState>((set, get) => ({
  isDarkMode: getInitialDarkMode(),
  isHamburgerOpen: false,
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.isDarkMode;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("ema_theme", next ? "dark" : "light");
        } catch {}
      }
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      updateUserPreference({ theme: next ? "dark" : "light" }).catch(() => {});
      return { isDarkMode: next };
    }),
  setDarkMode: (isDark) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ema_theme", isDark ? "dark" : "light");
      } catch {}
    }
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    updateUserPreference({ theme: isDark ? "dark" : "light" }).catch(() => {});
    set({ isDarkMode: isDark });
  },

  toggleHamburger: () => set((state) => ({ isHamburgerOpen: !state.isHamburgerOpen })),
  setHamburgerOpen: (isOpen) => set({ isHamburgerOpen: isOpen }),

  viewedSteps: {},
  expandedSteps: [],

  markStepViewed: (projectId, stepId) =>
    set((state) => {
      const current = state.viewedSteps[projectId] || [];
      if (current.includes(stepId)) return state;
      return {
        viewedSteps: {
          ...state.viewedSteps,
          [projectId]: [...current, stepId],
        },
      };
    }),

  markAllStepsViewed: (projectId, stepIds) =>
    set((state) => ({
      viewedSteps: {
        ...state.viewedSteps,
        [projectId]: stepIds,
      },
    })),

  toggleStepExpanded: (stepId) =>
    set((state) => {
      const exists = state.expandedSteps.includes(stepId);
      return {
        expandedSteps: exists
          ? state.expandedSteps.filter((id) => id !== stepId)
          : [...state.expandedSteps, stepId],
      };
    }),

  expandAllSteps: (stepIds) => set({ expandedSteps: stepIds }),
  collapseAllSteps: () => set({ expandedSteps: [] }),

  isSimulatingApiError: false,
  toggleSimulateApiError: () =>
    set((state) => ({ isSimulatingApiError: !state.isSimulatingApiError })),

  notifications: [],
  addNotification: (message, type = "warning") => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    set((state) => ({
      notifications: [...state.notifications, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeNotification(id);
    }, 4000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  notifyBackendRequired: (featureName) => {
    get().addNotification(`${featureName} requires API connectivity.`, "info");
  },
}));
