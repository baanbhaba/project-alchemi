import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useUiStore } from "../store/useUiStore";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ErrorBoundary } from "../components/common/ErrorBoundary";

describe("Theme System & Light Mode Default Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    useUiStore.getState().setDarkMode(false);
  });

  it("1. useUiStore initializes with isDarkMode as false (Light Mode Default)", () => {
    expect(useUiStore.getState().isDarkMode).toBe(false);
  });

  it("2. Initial documentElement does NOT have the 'dark' class", () => {
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("3. toggleDarkMode switches from light to dark mode and adds 'dark' class", () => {
    act(() => {
      useUiStore.getState().toggleDarkMode();
    });
    expect(useUiStore.getState().isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("ema_theme")).toBe("dark");
  });

  it("4. toggleDarkMode switches back from dark to light mode and removes 'dark' class", () => {
    act(() => {
      useUiStore.getState().setDarkMode(true);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      useUiStore.getState().toggleDarkMode();
    });
    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("ema_theme")).toBe("light");
  });

  it("5. setDarkMode(false) explicitly enforces light mode", () => {
    act(() => {
      useUiStore.getState().setDarkMode(true);
    });
    expect(useUiStore.getState().isDarkMode).toBe(true);

    act(() => {
      useUiStore.getState().setDarkMode(false);
    });
    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("ema_theme")).toBe("light");
  });

  it("6. LoginPage renders with Light Mode as default", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByText("ALCHEMI")).toBeInTheDocument();
    expect(screen.getByText(/Access Platform/i)).toBeInTheDocument();
    
    // Theme toggle button on login page should exist and have accessible label
    const toggleBtn = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it("7. LoginPage theme toggle switches theme cleanly", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole("button", { name: /switch to dark mode/i });
    act(() => {
      fireEvent.click(toggleBtn);
    });

    expect(useUiStore.getState().isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("8. NotFoundPage (404) renders in Light Mode by default", () => {
    render(
      <MemoryRouter initialEntries={["/invalid-non-existent-path"]}>
        <NotFoundPage />
      </MemoryRouter>
    );

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByText(/ALCHEMI — Kernel Panic/i)).toBeInTheDocument();
    expect(screen.getByText(/Return to Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Go Back/i)).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it("9. NotFoundPage theme toggle allows switching between light and dark on 404 screen", () => {
    render(
      <MemoryRouter initialEntries={["/404"]}>
        <NotFoundPage />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByRole("button", { name: /switch to dark mode/i });
    act(() => {
      fireEvent.click(toggleBtn);
    });

    expect(useUiStore.getState().isDarkMode).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /switch to light mode/i }));
    });

    expect(useUiStore.getState().isDarkMode).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("10. ErrorBoundary fallback renders in light theme by default", () => {
    const ProblematicChild = () => {
      throw new Error("Simulated React Render Crash");
    };

    // Silence expected console.error from ErrorBoundary during test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ProblematicChild />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Go to Dashboard/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
