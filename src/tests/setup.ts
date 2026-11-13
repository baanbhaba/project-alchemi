import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

try {
  process.loadEnvFile?.();
} catch {}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://alchemi:alchemi@localhost:5432/alchemi_dev";
}

afterEach(() => {
  cleanup();
});

const originalFetch = globalThis.fetch;

globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input.toString();

  if (url.includes("integrate.api.nvidia.com") || url.includes("api.aimlapi.com")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await originalFetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }
      console.warn(`NVIDIA/AIML API returned status ${response.status}. Falling back to mock response.`);
    } catch (err) {
      console.warn(`NVIDIA/AIML API call failed (${err}). Falling back to mock response.`);
    }

    // Generate high-fidelity mock responses matching test expectations
    let bodyText = "";
    if (init?.body) {
      if (typeof init.body === "string") {
        bodyText = init.body;
      } else if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
        bodyText = new TextDecoder().decode(init.body);
      }
    }

    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {}

    const messages = parsedBody.messages || [];
    const systemPrompt = messages.find((m: any) => m.role === "system")?.content || "";
    
    let content = "";
    if (systemPrompt.includes("Core Analysis Agent")) {
      content = JSON.stringify({
        architecture_summary: "Payment controller using Spring Boot RestController with processPayment endpoint.",
        confidence: 0.95,
      });
    } else if (systemPrompt.includes("Code Migration Engine")) {
      content = `
// Migrated from Java to Rust Axum
use axum::{routing::post, Router, extract::Form};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct PaymentRequest {
    amount: String,
}

pub async fn process_payment(Form(req): Form<PaymentRequest>) -> String {
    format!("Payment processed for: {}", req.amount)
}

pub fn app() -> Router {
    Router::new().route("/api/v1/pay", post(process_payment))
}
      `.trim();
    } else if (systemPrompt.includes("Blueprint Agent")) {
      content = JSON.stringify({
        project_id: "billing-service",
        steps: [
          {
            id: "step-1",
            file_or_module: "BillingController",
            what_changes: "Migrate REST Endpoint",
            why: "Axum support for billing downloads",
            target_pattern: "downloadPdfInvoice",
            risk_level: "low",
            depends_on: [],
            status: "pending",
          },
        ],
      });
    } else {
      content = "Mock response from NVIDIA Llama 3.1 70B Instruct";
    }

    const mockData = {
      choices: [
        {
          message: {
            role: "assistant",
            content: content,
          },
        },
      ],
    };

    return new Response(JSON.stringify(mockData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return originalFetch(input, init);
};

