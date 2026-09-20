import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default("/api/v1"),
  VITE_USE_MOCKS: z.enum(["true", "false"]).default("false"),
  // Note: Add other variables here as needed in the future
});

export const env = envSchema.parse({
  VITE_API_BASE_URL: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) || process.env.VITE_API_BASE_URL || "/api/v1",
  VITE_USE_MOCKS: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_USE_MOCKS) || process.env.VITE_USE_MOCKS || "false",
});
