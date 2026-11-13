import { z } from "zod";

// --- Zod Schemas ---

export const DetectedStackItemSchema = z.object({
  technology: z.string(),
  version: z.string(),
  status: z.union([
    z.enum(["current", "deprecated", "eol"]),
    z.string().transform((v) => {
      const lower = v.toLowerCase();
      if (lower.includes("eol")) return "eol" as const;
      if (lower.includes("deprecat")) return "deprecated" as const;
      return "current" as const;
    }),
  ]),
  evidence: z.string().optional(),
});

export const DeprecatedUsageSchema = z.object({
  file: z.string(),
  line: z.union([z.number(), z.string().transform((v) => parseInt(v, 10) || 1)]),
  pattern: z.string(),
  severity: z.enum(["low", "medium", "high"]).optional(),
  recommended_replacement: z.string(),
});

export const DependencyGraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relationship: z.string().optional(),
    })
  ),
});

export const DiagramSchema = z.object({
  type: z.string(),
  format: z.string(),
  content: z.string(),
});

export const ConcurrencyModelSchema = z.object({
  uses_threads: z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")]),
  uses_executor_service: z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")]),
  shared_mutable_state: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export const MigrationComplexitySchema = z.object({
  score: z.union([z.number(), z.string().transform((v) => Number(v) || 5)]),
  drivers: z.array(z.string()).default([]),
});

export const CoreAuditSchema = z.object({
  architecture_summary: z.string(),
  detected_stack: z.array(DetectedStackItemSchema),
  deprecated_usages: z.array(DeprecatedUsageSchema),
  dependency_graph: DependencyGraphSchema,
  diagrams: z.array(DiagramSchema),
  concurrency_model: ConcurrencyModelSchema.optional(),
  migration_complexity: MigrationComplexitySchema.optional(),
  confidence: z.number().min(0).max(1),
  java_code: z.string().optional(),
  rust_code: z.string().optional(),
});

export const ApiSurfaceItemSchema = z.object({
  endpoint_or_interface: z.string(),
  consumers: z.array(z.string()),
  breaking_change_risk: z.enum(["low", "medium", "high"]),
  risk_reason: z.string().optional(),
});

export const ImpactItemSchema = z.object({
  component: z.string().optional(),
  file: z.string().optional(),
  risk: z.string(),
  notes: z.string(),
});

export const DependencyRiskSchema = z.object({
  dependency: z.string().optional(),
  library: z.string().optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  mitigation: z.string().optional(),
  current_version: z.string().optional(),
  target_version: z.string().optional(),
  known_breaking_changes: z.array(z.string()).optional(),
});

export const ConcurrencyAndStateRiskSchema = z.object({
  issue: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});

export const BlastRadiusItemSchema = z.object({
  change: z.string(),
  affected_files: z.array(z.string()),
  affected_systems: z.array(z.string()).optional(),
  severity: z.enum(["low", "medium", "high"]),
});

export const RolloutRecommendationSchema = z.object({
  strategy: z.enum(["big_bang", "strangler_fig", "parallel_run"]),
  reasoning: z.string(),
});

export const ImpactAuditSchema = z.object({
  api_surface: z.array(ApiSurfaceItemSchema),
  database_impacts: z.array(ImpactItemSchema),
  config_impacts: z.array(ImpactItemSchema),
  dependency_risks: z.array(DependencyRiskSchema),
  concurrency_and_state_risks: z.array(ConcurrencyAndStateRiskSchema).optional(),
  blast_radius: z.array(BlastRadiusItemSchema),
  rollout_recommendation: RolloutRecommendationSchema.optional(),
  confidence: z.number().min(0).max(1),
});

export const ConflictSchema = z.object({
  topic: z.string(),
  core_position: z.string(),
  impact_position: z.string(),
  resolved: z.boolean(),
});

export const ConsensusResultSchema = z.object({
  iteration: z.number(),
  conflicts: z.array(ConflictSchema),
  unified_confidence: z.number().min(0).max(1),
  should_iterate_again: z.boolean(),
});

export const ReadinessScoreBreakdownSchema = z.object({
  architecture_understanding: z.number(), // weight 20%
  dependency_resolution: z.number(),      // weight 15%
  api_compatibility: z.number(),          // weight 15%
  configuration_completeness: z.number(), // weight 10%
  migration_feasibility: z.number(),      // weight 20%
  breaking_change_risk: z.number(),       // weight 15% (inverted — higher is safer)
  rollback_availability: z.number(),      // weight 5%
});

export const ReadinessScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: ReadinessScoreBreakdownSchema,
});

export const BlueprintStepStatusSchema = z.enum(["pending", "approved", "rejected"]);

export const BlueprintStepSchema = z.object({
  id: z.string(),
  file_or_module: z.string(),
  what_changes: z.string(),
  why: z.string(),
  target_pattern: z.string(),
  risk_level: z.enum(["low", "medium", "high"]),
  depends_on: z.array(z.string()),
  status: BlueprintStepStatusSchema,
  rejection_reason: z.string().optional(),
});

export const BlueprintSchema = z.object({
  project_id: z.string(),
  steps: z.array(BlueprintStepSchema),
});

export const ValidationResultSchema = z.object({
  unit: z.string(),
  build_status: z.enum(["pass", "fail"]),
  tests_run: z.number(),
  tests_passed: z.number(),
  lint_issues: z.array(z.string()),
  coverage_note: z.string(),
});

export const MigrationReportEntrySchema = z.object({
  unit: z.string(),
  diff: z.string(),
  java_code: z.string().optional(),
  rust_code: z.string().optional(),
  validation: ValidationResultSchema,
  approved_by: z.string(),
  approved_at: z.string(),
});

export const MigrationReportSchema = z.object({
  project_id: z.string(),
  core_audit: CoreAuditSchema,
  impact_audit: ImpactAuditSchema,
  blueprint: BlueprintSchema,
  entries: z.array(MigrationReportEntrySchema),
  rollback_plan: z.string(),
});

export const ProjectSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  repo_url: z.string().default("N/A"),
  stage: z.enum([
    "ingesting",
    "analyzing",
    "awaiting_approval",
    "transforming",
    "validating",
    "done",
  ]),
  readiness_score: z.number().optional(), // 0-100
  last_updated: z.string(), // ISO string
  java_from: z.string().default("Java 8"),
  java_to: z.string().default("Java 21"),
});

// --- TypeScript Types Inferred from Zod ---

export type DetectedStackItem = z.infer<typeof DetectedStackItemSchema>;
export type DeprecatedUsage = z.infer<typeof DeprecatedUsageSchema>;
export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
export type CoreAudit = z.infer<typeof CoreAuditSchema>;

export type ApiSurfaceItem = z.infer<typeof ApiSurfaceItemSchema>;
export type ImpactItem = z.infer<typeof ImpactItemSchema>;
export type DependencyRisk = z.infer<typeof DependencyRiskSchema>;
export type BlastRadiusItem = z.infer<typeof BlastRadiusItemSchema>;
export type ImpactAudit = z.infer<typeof ImpactAuditSchema>;

export type Conflict = z.infer<typeof ConflictSchema>;
export type ConsensusResult = z.infer<typeof ConsensusResultSchema>;
export type ReadinessScoreBreakdown = z.infer<typeof ReadinessScoreBreakdownSchema>;
export type ReadinessScore = z.infer<typeof ReadinessScoreSchema>;

export type BlueprintStepStatus = z.infer<typeof BlueprintStepStatusSchema>;
export type BlueprintStep = z.infer<typeof BlueprintStepSchema>;
export type Blueprint = z.infer<typeof BlueprintSchema>;

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type MigrationReportEntry = z.infer<typeof MigrationReportEntrySchema>;
export type MigrationReport = z.infer<typeof MigrationReportSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

// --- Unified Migration & Verification Schemas ---

export const VerificationAgentTypeSchema = z.enum([
  "syntax_compilation",
  "semantic_equivalence",
  "architecture_framework",
  "security",
  "migration_completeness",
]);

export const VerificationSeveritySchema = z.enum(["critical", "warning", "info"]);

export const VerificationStatusSchema = z.enum(["passed", "failed", "warning", "error"]);

export const VerificationIssueSchema = z.object({
  severity: VerificationSeveritySchema,
  file: z.string(),
  line: z.number().optional(),
  category: z.string(),
  description: z.string(),
  recommendation: z.string(),
});

export const VerificationResultSchema = z.object({
  agent: VerificationAgentTypeSchema,
  status: VerificationStatusSchema,
  confidence: z.number().min(0).max(1),
  issues: z.array(VerificationIssueSchema),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  execution_time_ms: z.number().optional(),
});

export const VerificationReadinessBreakdownSchema = z.object({
  compilation: z.number(),
  semantic_equivalence: z.number(),
  completeness: z.number(),
  architecture: z.number(),
  security: z.number(),
  critical_penalty: z.number(),
  details: z.array(z.string()),
});

export const MigrationStatusSchema = z.enum([
  "pending",
  "generating",
  "generated",
  "verifying",
  "completed",
  "failed",
]);

export const MigrationContextSchema = z.object({
  migration_id: z.string(),
  project_id: z.string(),
  original_java_source: z.string(),
  generated_rust_source: z.string(),
  migration_timestamp: z.string(),
  source_file_mapping: z.record(z.string(), z.string()),
  detected_framework: z.string(),
  target_framework: z.string(),
  migration_status: MigrationStatusSchema,
  verification_results: z.record(VerificationAgentTypeSchema, VerificationResultSchema),
  readiness_score: z.number().min(0).max(100),
  readiness_breakdown: VerificationReadinessBreakdownSchema,
  generation_call_count: z.number().default(1),
  error: z.string().optional(),
});

export type VerificationAgentType = z.infer<typeof VerificationAgentTypeSchema>;
export type VerificationSeverity = z.infer<typeof VerificationSeveritySchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type VerificationIssue = z.infer<typeof VerificationIssueSchema>;
export type VerificationResult = {
  agent: VerificationAgentType;
  status: VerificationStatus;
  confidence: number;
  issues: VerificationIssue[];
  metrics: Record<string, number | string | boolean>;
  execution_time_ms?: number;
};
export type VerificationReadinessBreakdown = z.infer<typeof VerificationReadinessBreakdownSchema>;
export type MigrationStatus = z.infer<typeof MigrationStatusSchema>;
export type MigrationContext = {
  migration_id: string;
  project_id: string;
  original_java_source: string;
  generated_rust_source: string;
  migration_timestamp: string;
  source_file_mapping: Record<string, string>;
  detected_framework: string;
  target_framework: string;
  migration_status: MigrationStatus;
  verification_results: Record<VerificationAgentType, VerificationResult>;
  readiness_score: number;
  readiness_breakdown: VerificationReadinessBreakdown;
  generation_call_count: number;
  error?: string;
};


