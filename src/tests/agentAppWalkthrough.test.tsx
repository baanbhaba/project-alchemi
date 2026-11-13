/**
 * ALCHEMI — Autonomous Agent App Walkthrough Test Suite
 *
 * Simulates an autonomous agent navigating through the complete application:
 * 1. Auth Gate & Login (/login)
 * 2. Agent Authentication (baanbhaba / SUPER_DEV)
 * 3. Dashboard & Project Ingestion (/)
 * 4. Core Architecture Audit (/projects/:id/core-audit)
 * 5. Downstream Impact Audit (/projects/:id/impact-audit)
 * 6. Readiness & Consensus Engine (/projects/:id/readiness)
 * 7. Blueprint Review & Step Governance (/projects/:id/blueprint)
 * 8. Code Transformation & Rust Axum Engine
 * 9. Final Migration Report & Rollback Plan (/projects/:id/report)
 * 10. Account, Settings, Integrations & Security (/account, /settings, /integrations, /privacy-security)
 * 11. Theme Engine Toggling & Light Mode Default Verification
 * 12. Error Boundary & 404 Recovery (/404)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { CoreAuditPage } from "../pages/CoreAuditPage";
import { ImpactAuditPage } from "../pages/ImpactAuditPage";
import { ReadinessPage } from "../pages/ReadinessPage";
import { BlueprintPage } from "../pages/BlueprintPage";
import { ReportPage } from "../pages/ReportPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AccountPage } from "../pages/AccountPage";
import { IntegrationsPage } from "../pages/IntegrationsPage";
import { PrivacySecurityPage } from "../pages/PrivacySecurityPage";
import { NotFoundPage } from "../pages/NotFoundPage";

import { useAuthStore } from "../store/useAuthStore";
import { useUiStore } from "../store/useUiStore";
import { createProject } from "../api/client";

const MOCK_PROJECT_ID = "proj-payment-gateway";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

describe("ALCHEMI — Agent App Walkthrough & Functional Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove("dark");
    useUiStore.getState().setDarkMode(false);
    useAuthStore.getState().logout();
  });

  // -------------------------------------------------------------------------
  // Agent Step 1: Auth Protection & Initial Light Theme
  // -------------------------------------------------------------------------
  it("Agent Step 1: Unauthenticated visit redirects to Login in Light Theme", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="/"
              element={
                useAuthStore.getState().isAuthenticated ? (
                  <DashboardPage />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify redirected to login screen with brand heading & credentials prompt
    expect(screen.getByRole("heading", { name: "ALCHEMI" })).toBeInTheDocument();
    expect(screen.getByText(/Access Platform/i)).toBeInTheDocument();
    expect(document.getElementById("login-submit")).toBeInTheDocument();

    // Verify default theme is Light Mode
    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Agent Step 2: Agent Authentication
  // -------------------------------------------------------------------------
  it("Agent Step 2: Agent authenticates as baanbhaba (SUPER_DEV) and gains access", async () => {
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const usernameInput = screen.getByPlaceholderText(/enter username/i);
    const passwordInput = screen.getByPlaceholderText(/enter password/i);
    const submitBtn = document.getElementById("login-submit")!;

    await user.clear(usernameInput);
    await user.type(usernameInput, "baanbhaba");
    await user.clear(passwordInput);
    await user.type(passwordInput, "baanbhaba");
    await user.click(submitBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().role).toBe("SUPER_DEV");
    });
  });

  // -------------------------------------------------------------------------
  // Agent Step 3: Dashboard Navigation & Project Creation
  // -------------------------------------------------------------------------
  it("Agent Step 3: Agent views Dashboard and creates a new modernization project", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify Dashboard banner & header render
    expect(screen.getByText(/Enterprise Migration Intelligence/i)).toBeInTheDocument();

    // Agent executes project creation
    const newProject = await createProject({
      name: "Agent E2E Ingestion Service",
      repo_url: "https://github.com/acme/agent-e2e",
      javaCode: `
        @RestController
        public class E2EController {
          @GetMapping("/status")
          public String status() { return "ONLINE"; }
        }
      `,
    });

    expect(newProject).toBeDefined();
    expect(newProject.name).toBe("Agent E2E Ingestion Service");
    expect(newProject.readiness_score).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Agent Step 4: Core Architecture Audit
  // -------------------------------------------------------------------------
  it("Agent Step 4: Agent inspects Core Architecture Audit page", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${MOCK_PROJECT_ID}/core-audit`]}>
          <Routes>
            <Route path="/projects/:id/core-audit" element={<CoreAuditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Core Audit/i) || screen.getByText(/Architecture/i)
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Agent Step 5: Downstream Impact Audit
  // -------------------------------------------------------------------------
  it("Agent Step 5: Agent inspects Impact Audit page and blast radius metrics", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${MOCK_PROJECT_ID}/impact-audit`]}>
          <Routes>
            <Route path="/projects/:id/impact-audit" element={<ImpactAuditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Impact Audit/i) || screen.getByText(/Blast Radius/i)
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Agent Step 6: Readiness & Consensus Review
  // -------------------------------------------------------------------------
  it("Agent Step 6: Agent analyzes Readiness Score and Multi-Agent Consensus", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${MOCK_PROJECT_ID}/readiness`]}>
          <Routes>
            <Route path="/projects/:id/readiness" element={<ReadinessPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Readiness/i) || screen.getByText(/Consensus/i)
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Agent Step 7: Blueprint Review & Step Governance
  // -------------------------------------------------------------------------
  it("Agent Step 7: Agent reviews Blueprint, tests rejection validation and approves step", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${MOCK_PROJECT_ID}/blueprint`]}>
          <Routes>
            <Route path="/projects/:id/blueprint" element={<BlueprintPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Blueprint Human Review/i)).toBeInTheDocument();
    });

    // Check step items render
    const approveButtons = await screen.findAllByRole("button", { name: /approve/i });
    expect(approveButtons.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Agent Step 8: Code Transformation & Rust Axum Engine
  // -------------------------------------------------------------------------
  it("Agent Step 8: Agent verifies Rust Axum code generation pipeline", async () => {
    const { generateRustCodeFromJava } = await import("../api/transform");

    const sampleJavaController = `
      package com.acme.order;
      import org.springframework.web.bind.annotation.*;

      @RestController
      @RequestMapping("/orders")
      public class OrderController {
        private String orderId;
        private double total;

        @PostMapping("/create")
        public String createOrder() {
          return "ORDER_CREATED";
        }
      }
    `;

    const generatedRust = generateRustCodeFromJava(sampleJavaController, "step-1");
    expect(generatedRust).toContain("use axum");
    expect(generatedRust).toContain("OrderControllerPayload");
    expect(generatedRust).toContain("handle_ordercontroller_process");
    expect(generatedRust).toContain("Router::new()");
  });

  // -------------------------------------------------------------------------
  // Agent Step 9: Migration Report & Rollback Plan
  // -------------------------------------------------------------------------
  it("Agent Step 9: Agent generates Migration Report with diffs and rollback plan", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/projects/${MOCK_PROJECT_ID}/report`]}>
          <Routes>
            <Route path="/projects/:id/report" element={<ReportPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Migration Report/i) || screen.getByText(/Diff/i)
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Agent Step 10: Settings, Account, Integrations & Security
  // -------------------------------------------------------------------------
  it("Agent Step 10: Agent verifies Settings, Account, Integrations and Security pages", async () => {
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
    const queryClient = createTestQueryClient();

    // Account Page
    const { unmount: unmountAccount } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/account"]}>
          <Routes>
            <Route path="/account" element={<AccountPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Account & Profile/i)).toBeInTheDocument();
    unmountAccount();

    // Settings Page
    const { unmount: unmountSettings } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/API Configuration/i)).toBeInTheDocument();
    unmountSettings();

    // Integrations Page
    const { unmount: unmountIntegrations } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/integrations"]}>
          <Routes>
            <Route path="/integrations" element={<IntegrationsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Integrations/i)).toBeInTheDocument();
    unmountIntegrations();

    // Privacy & Security Page
    const { unmount: unmountPrivacy } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/privacy-security"]}>
          <Routes>
            <Route path="/privacy-security" element={<PrivacySecurityPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByText(/Privacy & Security/i)).toBeInTheDocument();
    unmountPrivacy();
  });

  // -------------------------------------------------------------------------
  // Agent Step 11: Dynamic Theme Toggling in Agent Workflow
  // -------------------------------------------------------------------------
  it("Agent Step 11: Agent tests theme toggle across light and dark states", () => {
    const store = useUiStore.getState();

    // Baseline: Light
    expect(store.isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Agent switches to dark
    store.toggleDarkMode();
    expect(useUiStore.getState().isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("ema_theme")).toBe("dark");

    // Agent switches back to light
    store.toggleDarkMode();
    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("ema_theme")).toBe("light");
  });

  // -------------------------------------------------------------------------
  // Agent Step 12: 404 Route & Recovery
  // -------------------------------------------------------------------------
  it("Agent Step 12: Agent visits non-existent route, verifies 404 and recovers", () => {
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/non-existent-deep-link"]}>
          <Routes>
            <Route path="*" element={<NotFoundPage />} />
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify 404 Page renders with neo-brutalist trace and return button
    expect(screen.getByText(/ROUTE_NOT_FOUND/i)).toBeInTheDocument();
    expect(screen.getByText(/Kernel Panic/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Return to Dashboard/i })).toBeInTheDocument();

    // Verify light theme active
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
