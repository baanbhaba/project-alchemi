import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../pages/DashboardPage";
import { deleteProject, getProjects, createProject } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";

describe("Dashboard Project Deletion Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().login("baanbhaba", "baanbhaba");
  });

  it("deleteProject removes project from in-memory and persistent cache", async () => {
    const created = await createProject({
      name: "To Be Deleted",
      repo_url: "https://github.com/acme/delete-me",
      javaCode: "public class DeleteMe {}",
    });

    sessionStorage.setItem("ema_selected_project_id", created.id);
    sessionStorage.setItem(`ema_blueprint_${created.id}`, "{}");

    const projectsBefore = await getProjects();
    expect(projectsBefore.some((p) => p.id === created.id)).toBe(true);

    const result = await deleteProject(created.id);
    expect(result).toBe(true);

    expect(sessionStorage.getItem("ema_selected_project_id")).toBeNull();
    expect(sessionStorage.getItem(`ema_blueprint_${created.id}`)).toBeNull();

    const projectsAfter = await getProjects();
    expect(projectsAfter.some((p) => p.id === created.id)).toBe(false);
  });

  it("clicking the delete button opens confirmation modal and confirms removal", async () => {
    const testProject = await createProject({
      name: "Trash Modal Test",
      repo_url: "https://github.com/acme/trash-test",
      javaCode: "public class TrashTest {}",
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify project appears in Dashboard
    await waitFor(() => {
      expect(screen.getByText("Trash Modal Test")).toBeInTheDocument();
    });

    // Click trash button
    const trashBtn = screen.getByLabelText(`Remove project Trash Modal Test`);
    await user.click(trashBtn);

    // Modal should be open with warning text
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Delete Project" })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getByText(/permanently erased/i)).toBeInTheDocument();
    });

    // Click Delete Project button in the modal
    const confirmDeleteBtn = screen.getByRole("button", { name: /Delete Project/i });
    await user.click(confirmDeleteBtn);

    // Project should be removed
    await waitFor(() => {
      expect(screen.queryByText("Trash Modal Test")).not.toBeInTheDocument();
    });
  });
});
