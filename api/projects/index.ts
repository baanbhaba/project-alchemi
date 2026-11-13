import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../src/lib/prisma.js";
import { mapProjectToSummary } from "../../src/server/projectMapping.js";
import {
  detectJavaStack,
  detectJavaDeprecatedUsages,
  detectJavaImpactAudit,
  calculateReadinessScore,
  generateDetailedMermaidDiagrams,
} from "../../src/lib/analysis.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          coreAudit: true,
          impactAudit: true,
          readinessAssessment: true,
        },
      });
      return res.status(200).json(projects.map(mapProjectToSummary));
    } catch (error) {
      console.error("GET /api/projects error:", error);
      return res.status(500).json({ error: "Failed to fetch projects" });
    }
  }

  if (req.method === "POST") {
    try {
      const { id, name, repoUrl, repo_url, stage, javaCode } = req.body || {};

      if (!name) {
        return res.status(400).json({ error: "Project name is required" });
      }

      let initialReadiness = 0;
      let coreDataToCreate: any = undefined;
      let impactDataToCreate: any = undefined;

      if (javaCode && javaCode.trim()) {
        const fileName = `${name.replace(/[^a-zA-Z0-9_]/g, "")}.java`;
        const detectedStack = detectJavaStack(javaCode);
        const deprecatedUsages = detectJavaDeprecatedUsages(javaCode, fileName);
        const diagrams = generateDetailedMermaidDiagrams(javaCode, name);
        const core = {
          id: "",
          projectId: "",
          architecture_summary: `Modernized microservice topology for ${name} translated to Tokio runtime and Axum 0.7 routes.`,
          architectureSummary: `Modernized microservice topology for ${name} translated to Tokio runtime and Axum 0.7 routes.`,
          detected_stack: detectedStack,
          detectedStack,
          deprecated_usages: deprecatedUsages,
          deprecatedUsages,
          dependency_graph: { nodes: [name], edges: [] },
          dependencyGraph: { nodes: [name], edges: [] },
          diagrams,
          confidence: 0.95,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const impact = detectJavaImpactAudit(javaCode, fileName);
        const readiness = calculateReadinessScore(core, impact, null);
        initialReadiness = readiness.overall;

        coreDataToCreate = {
          architectureSummary: core.architectureSummary,
          detectedStack: core.detectedStack,
          deprecatedUsages: core.deprecatedUsages,
          dependencyGraph: core.dependencyGraph,
          diagrams: core.diagrams,
          confidence: core.confidence,
        };

        impactDataToCreate = {
          apiSurface: impact.api_surface,
          databaseImpacts: impact.database_impacts,
          configImpacts: impact.config_impacts,
          dependencyRisks: impact.dependency_risks,
          blastRadius: impact.blast_radius,
          confidence: impact.confidence,
        };
      }

      const project = await prisma.project.create({
        data: {
          id: id || undefined,
          name,
          repoUrl: repoUrl || repo_url || "",
          stage: stage || (javaCode ? "analyzing" : "ingesting"),
          readinessScore: initialReadiness,
          uploadedSources: javaCode
            ? {
                create: [
                  {
                    fileName: `${name.replace(/[^a-zA-Z0-9_]/g, "")}.java`,
                    rawCode: javaCode,
                    language: "java",
                  },
                ],
              }
            : undefined,
          blueprint: {
            create: {
              version: 1,
              steps: {
                create: [
                  {
                    stepNumber: 1,
                    fileOrModule: `${name.replace(/[^a-zA-Z0-9_]/g, "")}.java`,
                    whatChanges: "Upgrade bytecode & convert REST controller logic to Axum router",
                    why: "Modernize Java application to Rust Tokio runtime",
                    targetPattern: "",
                    riskLevel: "medium",
                    status: "pending",
                  },
                ],
              },
            },
          },
          coreAudit: coreDataToCreate ? { create: coreDataToCreate } : undefined,
          impactAudit: impactDataToCreate ? { create: impactDataToCreate } : undefined,
        },
        include: {
          blueprint: { include: { steps: true } },
          uploadedSources: true,
          coreAudit: true,
          impactAudit: true,
        },
      });

      return res.status(201).json(mapProjectToSummary(project));
    } catch (error) {
      console.error("POST /api/projects error:", error);
      return res.status(500).json({ error: "Failed to create project" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
