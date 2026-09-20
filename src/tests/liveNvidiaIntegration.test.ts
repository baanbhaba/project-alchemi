import { describe, it, expect } from "vitest";

const NVIDIA_KEY =
  (import.meta as any).env?.VITE_NVIDIA_API_KEY ||
  process.env.VITE_NVIDIA_API_KEY ||
  process.env.NVIDIA_API_KEY ||
  "";
const ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

const sampleJavaCode = `
package com.acme.payment;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PostMapping;

@RestController
@Entity
public class PaymentController {
    @Id
    private String paymentId;

    @PostMapping("/api/v1/pay")
    public String processPayment(HttpServletRequest req) {
        return "Payment processed for: " + req.getParameter("amount");
    }
}
`;

describe("Empirical Live NVIDIA NIM AI Model Verification", () => {
  it("Executes live Core Audit analysis using NVIDIA Llama 3.1 70B Instruct", async () => {
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
            content: "You are the EMA Core Analysis Agent. Return ONLY valid JSON with keys: architecture_summary, confidence.",
          },
          {
            role: "user",
            content: `Analyze this Java 8 code:\n${sampleJavaCode}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("=== LIVE NVIDIA AI CORE AUDIT RESPONSE ===");
    console.log(content);
    expect(content).toBeDefined();
  }, 60000);

  it("Executes live Java 8 -> Rust Axum code transformation using NVIDIA Llama 3.1 70B Instruct", async () => {
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
            content: "You are the EMA Code Migration Engine. Convert the given Java 8 RestController to a Rust Axum router handler function. Output ONLY Rust code.",
          },
          {
            role: "user",
            content: `Migrate to Rust Axum:\n${sampleJavaCode}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 400,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log("=== LIVE NVIDIA AI RUST CODE TRANSFORMATION RESPONSE ===");
    console.log(content);
    expect(content).toBeDefined();
    expect(content.toLowerCase()).toContain("axum");
  }, 60000);
});
