import React, { lazy, Suspense } from "react";
import { HashRouter, BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/common/PageTransition";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { useAuthStore } from "./store/useAuthStore";
import { useUiStore } from "./store/useUiStore";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { Toaster } from "sonner";

// Lazy-loaded pages to optimize initial bundle size & load times
const LoginPage = lazy(() => import("./pages/LoginPage").then(m => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const CoreAuditPage = lazy(() => import("./pages/CoreAuditPage").then(m => ({ default: m.CoreAuditPage })));
const ImpactAuditPage = lazy(() => import("./pages/ImpactAuditPage").then(m => ({ default: m.ImpactAuditPage })));
const ReadinessPage = lazy(() => import("./pages/ReadinessPage").then(m => ({ default: m.ReadinessPage })));
const BlueprintPage = lazy(() => import("./pages/BlueprintPage").then(m => ({ default: m.BlueprintPage })));
const ReportPage = lazy(() => import("./pages/ReportPage").then(m => ({ default: m.ReportPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const AccountPage = lazy(() => import("./pages/AccountPage").then(m => ({ default: m.AccountPage })));
const IntegrationsPage = lazy(() => import("./pages/IntegrationsPage").then(m => ({ default: m.IntegrationsPage })));
const PrivacySecurityPage = lazy(() => import("./pages/PrivacySecurityPage").then(m => ({ default: m.PrivacySecurityPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })));

const PageFallback: React.FC = () => (
  <div className="p-8 flex items-center justify-center space-x-2 text-xs text-zinc-400 font-mono">
    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    <span>Loading view...</span>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><DashboardPage /></PageTransition>} />
            <Route path="/projects/:id/core-audit" element={<PageTransition><CoreAuditPage /></PageTransition>} />
            <Route path="/projects/:id/impact-audit" element={<PageTransition><ImpactAuditPage /></PageTransition>} />
            <Route path="/projects/:id/readiness" element={<PageTransition><ReadinessPage /></PageTransition>} />
            <Route path="/projects/:id/blueprint" element={<PageTransition><BlueprintPage /></PageTransition>} />
            <Route path="/projects/:id/report" element={<PageTransition><ReportPage /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><SettingsPage /></PageTransition>} />
            <Route path="/account" element={<PageTransition><AccountPage /></PageTransition>} />
            <Route path="/integrations" element={<PageTransition><IntegrationsPage /></PageTransition>} />
            <Route path="/privacy-security" element={<PageTransition><PrivacySecurityPage /></PageTransition>} />
            {/* Custom 404 inside protected area */}
            <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </Layout>
  );
};

const isElectron = navigator.userAgent.toLowerCase().includes('electron') || window.location.protocol === 'file:';
const RouterComponent = isElectron ? HashRouter : BrowserRouter;

export const App: React.FC = () => {
  const { isDarkMode } = useUiStore();

  return (
    <ErrorBoundary>
      <Toaster position="bottom-right" richColors closeButton theme={isDarkMode ? "dark" : "light"} />
      <QueryClientProvider client={queryClient}>
        <RouterComponent>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={<ProtectedLayout />} />
              {/* Global 404 for anything completely outside the app */}
              <Route path="/404" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RouterComponent>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
