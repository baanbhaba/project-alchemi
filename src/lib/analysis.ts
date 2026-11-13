import type {
  CoreAudit,
  ImpactAudit,
  ConsensusResult,
  ReadinessScore,
  Conflict,
  DetectedStackItem,
  DeprecatedUsage,
  ApiSurfaceItem,
  ImpactItem,
  DependencyRisk,
  BlastRadiusItem,
} from "../types/contracts";

export function detectJavaStack(javaCode: string): DetectedStackItem[] {
  const stack: DetectedStackItem[] = [];
  if (!javaCode) return [{ technology: "Java", version: "8.0", status: "eol" }];

  if (javaCode.includes("record ") || javaCode.includes("sealed class") || javaCode.includes("permits ")) {
    stack.push({ technology: "Java", version: "17.0+", status: "current" });
  } else if (javaCode.includes("var ") || javaCode.includes("List.of(") || javaCode.includes("Map.of(")) {
    stack.push({ technology: "Java", version: "11.0", status: "deprecated" });
  } else {
    stack.push({ technology: "Java", version: "1.8.0", status: "eol" });
  }

  if (javaCode.includes("@SpringBootApplication") || javaCode.includes("@RestController") || javaCode.includes("@Autowired")) {
    if (javaCode.includes("jakarta.")) {
      stack.push({ technology: "Spring Boot", version: "3.2.0", status: "current" });
    } else {
      stack.push({ technology: "Spring Boot", version: "2.4.0", status: "eol" });
    }
  }

  if (javaCode.includes("javax.persistence") || javaCode.includes("jakarta.persistence") || javaCode.includes("Entity")) {
    const status = javaCode.includes("javax.") ? "deprecated" : "current";
    stack.push({ technology: "JPA / Hibernate ORM", version: javaCode.includes("javax.") ? "5.4" : "6.2", status });
  }

  if (javaCode.includes("javax.servlet") || javaCode.includes("jakarta.servlet") || javaCode.includes("HttpServlet")) {
    const status = javaCode.includes("javax.") ? "eol" : "current";
    stack.push({ technology: "Servlet API", version: javaCode.includes("javax.") ? "3.1" : "5.0", status });
  }

  if (javaCode.includes("sun.misc.Unsafe")) {
    stack.push({ technology: "sun.misc.Unsafe (Internal API)", version: "1.8", status: "eol" });
  }

  if (javaCode.includes("java.util.Date") || javaCode.includes("java.util.Calendar")) {
    stack.push({ technology: "Legacy Date/Time API (java.util.Date)", version: "1.0", status: "deprecated" });
  }

  if (javaCode.includes("Thread.stop") || javaCode.includes("Thread.suspend") || javaCode.includes("Thread.resume")) {
    stack.push({ technology: "Deprecated Thread Control API", version: "1.2", status: "deprecated" });
  }

  return stack;
}

export function detectJavaDeprecatedUsages(javaCode: string, fileName: string): DeprecatedUsage[] {
  const usages: DeprecatedUsage[] = [];
  if (!javaCode) return usages;

  const lines = javaCode.split("\n");

  lines.forEach((lineText, idx) => {
    const lineNum = idx + 1;

    if (lineText.includes("new Date(")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "new Date(int,int,int)",
        recommended_replacement: "LocalDate.of() or Instant.now()",
      });
    }

    if (lineText.includes(".getYear()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "date.getYear()",
        recommended_replacement: "LocalDate.getYear()",
      });
    }

    if (lineText.includes(".getMonth()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "date.getMonth()",
        recommended_replacement: "LocalDate.getMonthValue()",
      });
    }

    if (lineText.includes(".getDate()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "date.getDate()",
        recommended_replacement: "LocalDate.getDayOfMonth()",
      });
    }

    if (lineText.includes("Calendar.getInstance()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Calendar.getInstance()",
        recommended_replacement: "ZonedDateTime.now() or LocalDateTime.now()",
      });
    }

    if (lineText.includes("SimpleDateFormat")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "SimpleDateFormat (thread-unsafe)",
        recommended_replacement: "DateTimeFormatter (immutable & thread-safe)",
      });
    }

    if (lineText.includes(".stop()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Thread.stop()",
        recommended_replacement: "Thread.interrupt() with cooperative cancellation",
      });
    }

    if (lineText.includes(".suspend()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Thread.suspend()",
        recommended_replacement: "ReentrantLock / CountDownLatch synchronization",
      });
    }

    if (lineText.includes(".resume()")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Thread.resume()",
        recommended_replacement: "Condition.signal() / LockSupport.unpark()",
      });
    }

    if (lineText.includes("javax.persistence")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "javax.persistence.*",
        recommended_replacement: "jakarta.persistence.* (Jakarta EE 10+)",
      });
    }

    if (lineText.includes("javax.servlet")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "javax.servlet.*",
        recommended_replacement: "jakarta.servlet.* (Jakarta EE 10+)",
      });
    }

    if (lineText.includes("javax.ws.rs")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "javax.ws.rs.*",
        recommended_replacement: "jakarta.ws.rs.*",
      });
    }

    if (lineText.includes("sun.misc.Unsafe")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "sun.misc.Unsafe",
        recommended_replacement: "java.lang.foreign.MemorySegment / VarHandle",
      });
    }

    if (lineText.includes("SecurityManager") || lineText.includes("System.setSecurityManager")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "SecurityManager (Deprecated for Removal)",
        recommended_replacement: "OS container-level security (Docker / AppArmor)",
      });
    }

    if (lineText.includes("new Integer(") || lineText.includes("new Double(") || lineText.includes("new Boolean(")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Primitive Wrapper Constructor",
        recommended_replacement: "Integer.valueOf() or primitive parsing",
      });
    }

    if (lineText.includes("StringBuffer")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "StringBuffer",
        recommended_replacement: "StringBuilder (single-thread) or StringJoiner",
      });
    }

    if (lineText.includes("Vector<") || lineText.includes("Hashtable<")) {
      usages.push({
        file: fileName,
        line: lineNum,
        pattern: "Legacy Synchronized Collections (Vector / Hashtable)",
        recommended_replacement: "ArrayList / ConcurrentHashMap",
      });
    }
  });

  return usages;
}

export function detectJavaImpactAudit(javaCode: string, fileName: string): ImpactAudit {
  const api_surface: ApiSurfaceItem[] = [];
  const database_impacts: ImpactItem[] = [];
  const config_impacts: ImpactItem[] = [];
  const dependency_risks: DependencyRisk[] = [];
  const blast_radius: BlastRadiusItem[] = [];

  if (javaCode.includes("@RestController") || javaCode.includes("@GetMapping") || javaCode.includes("@PostMapping") || javaCode.includes("HttpServlet")) {
    api_surface.push({
      endpoint_or_interface: `REST Endpoints (${fileName})`,
      consumers: ["Client Applications", "Web Portal", "Mobile API Gateway"],
      breaking_change_risk: "medium",
    });
  } else {
    api_surface.push({
      endpoint_or_interface: `CLI / Core Application Entrypoint (${fileName})`,
      consumers: ["Internal Process / Orchestration Runner"],
      breaking_change_risk: "low",
    });
  }

  if (javaCode.includes("EntityManager") || javaCode.includes("javax.persistence") || javaCode.includes("jakarta.persistence") || javaCode.includes("DataSource")) {
    database_impacts.push({
      component: "JPA / Database Persistence Layer",
      risk: javaCode.includes("javax.persistence") ? "high" : "medium",
      notes: "Upgrade from Hibernate 5 / javax to Jakarta EE 10 / SQLx async driver requiring schema mapping verification.",
    });
  } else {
    database_impacts.push({
      component: "In-Memory / File State",
      risk: "low",
      notes: "No direct SQL/JPA database drivers detected in source code.",
    });
  }

  if (javaCode.includes("application.properties") || javaCode.includes("application.yml") || javaCode.includes("System.getProperty")) {
    config_impacts.push({
      component: "Application Configuration",
      risk: "low",
      notes: "Property keys migrated to Spring Boot 3 / environment variables.",
    });
  } else {
    config_impacts.push({
      component: "Environment Configuration",
      risk: "low",
      notes: "Standard environment parameterization applied.",
    });
  }

  if (javaCode.includes("sun.misc.Unsafe")) {
    dependency_risks.push({
      library: "sun.misc.Unsafe",
      current_version: "1.8",
      target_version: "Java 21 Foreign Function & Memory API (FFM)",
      known_breaking_changes: ["Internal API removed in modern JDKs; must use VarHandle or MemorySegment"],
    });
  }

  if (javaCode.includes("javax.")) {
    dependency_risks.push({
      library: "Java EE (javax.*)",
      current_version: "8.0",
      target_version: "Jakarta EE (jakarta.*)",
      known_breaking_changes: ["Package relocation from javax to jakarta across all EE specifications"],
    });
  }

  blast_radius.push({
    change: `Modernize ${fileName}`,
    affected_files: [fileName],
    severity: javaCode.includes("javax.") || javaCode.includes("Unsafe") ? "high" : "medium",
  });

  return {
    api_surface,
    database_impacts,
    config_impacts,
    dependency_risks,
    blast_radius,
    confidence: 0.92,
  };
}

export interface ReadinessBlueprint {
  steps?: Array<{ status?: string }>;
}

export function calculateReadinessScore(
  coreAudit?: CoreAudit | null,
  impactAudit?: ImpactAudit | null,
  blueprint?: ReadinessBlueprint | null
): ReadinessScore {
  const deprecatedUsages = coreAudit?.deprecated_usages || [];
  const detectedStack = coreAudit?.detected_stack || [];
  const deprecatedCount = deprecatedUsages.length;
  const eolCount = detectedStack.filter((s) => s.status === "eol").length;
  const deprecatedStackCount = detectedStack.filter((s) => s.status === "deprecated").length;

  const apiSurface = impactAudit?.api_surface || [];
  const highRiskApi = apiSurface.filter((a) => a.breaking_change_risk === "high").length;
  const medRiskApi = apiSurface.filter((a) => a.breaking_change_risk === "medium").length;

  const configImpacts = impactAudit?.config_impacts || [];
  const highRiskConfig = configImpacts.filter((c) => c.risk === "high").length;
  const medRiskConfig = configImpacts.filter((c) => c.risk === "medium").length;

  const dependencyRisks = impactAudit?.dependency_risks || [];

  const blastRadius = impactAudit?.blast_radius || [];
  const highSeverityBlast = blastRadius.filter((b) => b.severity === "high").length;
  const medSeverityBlast = blastRadius.filter((b) => b.severity === "medium").length;

  const dbImpacts = impactAudit?.database_impacts || [];
  const highDbRisk = dbImpacts.filter((d) => d.risk === "high").length;

  const steps = blueprint?.steps || [];
  const approvedSteps = steps.filter((s) => s.status === "approved").length;
  const rejectedSteps = steps.filter((s) => s.status === "rejected").length;

  const architecture_understanding = Math.max(50, Math.min(100, 96 - deprecatedCount * 4 - eolCount * 5 - deprecatedStackCount * 2));
  const dependency_resolution = Math.max(40, Math.min(100, 95 - dependencyRisks.length * 8 - eolCount * 6 - deprecatedStackCount * 3));
  const api_compatibility = Math.max(40, Math.min(100, 98 - highRiskApi * 15 - medRiskApi * 6));
  const configuration_completeness = Math.max(50, Math.min(100, 94 - highRiskConfig * 12 - medRiskConfig * 5));
  const migration_feasibility = Math.max(30, Math.min(100, 88 + approvedSteps * 4 - rejectedSteps * 10));
  const breaking_change_risk = Math.max(30, Math.min(100, 95 - highSeverityBlast * 15 - medSeverityBlast * 6));
  const rollback_availability = Math.max(50, Math.min(100, 96 - highDbRisk * 10));

  const overall = Math.round(
    architecture_understanding * 0.20 +
    migration_feasibility * 0.20 +
    dependency_resolution * 0.15 +
    api_compatibility * 0.15 +
    breaking_change_risk * 0.15 +
    configuration_completeness * 0.10 +
    rollback_availability * 0.05
  );

  return {
    overall,
    breakdown: {
      architecture_understanding,
      dependency_resolution,
      api_compatibility,
      configuration_completeness,
      migration_feasibility,
      breaking_change_risk,
      rollback_availability,
    },
  };
}

export function calculateConsensus(
  coreAudit?: CoreAudit | null,
  impactAudit?: ImpactAudit | null,
  primaryFile: string = "Main.java"
): ConsensusResult {
  const conflicts: Conflict[] = [];

  const apiSurface = impactAudit?.api_surface || [];
  const depUsages = coreAudit?.deprecated_usages || [];
  const depRisks = impactAudit?.dependency_risks || [];
  const dbImpacts = impactAudit?.database_impacts || [];

  const primaryApi = apiSurface[0]?.endpoint_or_interface || primaryFile;
  const apiRisk = apiSurface[0]?.breaking_change_risk || "low";

  conflicts.push({
    topic: `Target Migration Pattern & API Contract for ${primaryApi}`,
    core_position: `Convert ${primaryFile} structures and endpoints to native Rust Axum async handlers.`,
    impact_position: `Ensure zero breaking API contract changes for downstream consumers (${apiRisk.toUpperCase()} risk detected).`,
    resolved: apiRisk !== "high",
  });

  if (depUsages.length > 0 || depRisks.length > 0) {
    const mainPattern = depUsages[0]?.pattern || depRisks[0]?.dependency || depRisks[0]?.library || "Legacy Dependencies";
    const replacement = depUsages[0]?.recommended_replacement || depRisks[0]?.mitigation || depRisks[0]?.target_version || "Updated Crates/Packages";
    conflicts.push({
      topic: `Modernization Strategy: ${mainPattern}`,
      core_position: `Refactor legacy calls from '${mainPattern}' to '${replacement}'.`,
      impact_position: `Verify backward compatibility and non-breaking upgrade paths across all dependents.`,
      resolved: depRisks.length === 0 || !depRisks.some((d) => (d.known_breaking_changes?.length ?? 0) > 1),
    });
  }

  if (dbImpacts.length > 0) {
    const dbComp = dbImpacts[0].component || "Database Layer";
    conflicts.push({
      topic: `Database Integration (${dbComp})`,
      core_position: `Migrate legacy ORM/JPA mappings to SQLx / async Rust database drivers.`,
      impact_position: `Assess migration risk for schema locks, transaction boundaries, and pool connections (${dbImpacts[0].risk} risk).`,
      resolved: dbImpacts[0].risk !== "high",
    });
  }

  const coreConf = coreAudit?.confidence ?? 0.92;
  const impactConf = impactAudit?.confidence ?? 0.90;
  const unified_confidence = Math.round(((coreConf + impactConf) / 2) * 100) / 100;
  const hasUnresolved = conflicts.some((c) => !c.resolved);

  return {
    iteration: hasUnresolved ? 2 : 1,
    conflicts,
    unified_confidence,
    should_iterate_again: hasUnresolved || unified_confidence < 0.85,
  };
}

export { calculateVerificationReadiness } from "./verification";

