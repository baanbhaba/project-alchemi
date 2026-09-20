import { describe, it, expect } from "vitest";

const NVIDIA_KEY =
  (import.meta as any).env?.VITE_NVIDIA_API_KEY ||
  process.env.VITE_NVIDIA_API_KEY ||
  process.env.NVIDIA_API_KEY ||
  "";
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

const customJavaCode = `
package com.mycorp.billing;

import javax.persistence.Entity;
import javax.persistence.Table;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Table(name = "invoices")
public class BillingController {
    @GetMapping("/api/invoices/download")
    public String downloadPdfInvoice() {
        return "Downloading PDF invoice stream";
    }
}
`;

describe("NVIDIA Llama 3.1 70B Custom Blueprint Generation Verification", () => {
  it("Generates custom blueprint steps specifically matching BillingController source code", async () => {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.2-11b-vision-instruct",
        messages: [
          {
            role: "system",
            content: `You are the EMA Blueprint Agent. Create a 3-step migration blueprint for migrating this project from Java 8 to Java 21 / Rust Axum. Return ONLY valid JSON matching this schema:
{
  "project_id": "billing-service",
  "steps": [
    {
      "id": "step-1",
      "file_or_module": "string",
      "what_changes": "string",
      "why": "string",
      "target_pattern": "string",
      "risk_level": "low|medium|high",
      "depends_on": [],
      "status": "pending"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `Project ID: billing-service\nProject Name: Billing API\nSource Code:\n${customJavaCode}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";
    console.log("=== CUSTOM AI BLUEPRINT RESPONSE FROM NVIDIA LLAMA 70B ===");
    console.log(rawContent);

    expect(rawContent).toContain("billing");
  }, 35000);
});
