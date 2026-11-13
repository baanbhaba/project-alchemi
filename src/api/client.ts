let simulateErrorsGlobal = false;

export const setSimulateApiError = (enable: boolean) => {
  simulateErrorsGlobal = enable;
};

export const getSimulateApiError = () => simulateErrorsGlobal;

import { env } from "../config/env";

export const BASE_URL = env.VITE_API_BASE_URL;

const USE_MOCKS = env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  status: number;
  url: string;

  constructor(status: number, message: string, url: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (USE_MOCKS) {
    throw new ApiError(0, "VITE_USE_MOCKS=true: backend calls bypassed in favor of mock data", endpoint);
  }

  if (simulateErrorsGlobal) {
    throw new ApiError(503, "Simulated Backend API Error: 503 Service Unavailable", endpoint);
  }

  const rawUrl = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  const origin = typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:5173";

  const url = rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;

  const hasWindow = typeof window !== "undefined";
  const authState = (hasWindow ? (window as any).__EMA_AUTH_STATE__ : undefined) || {};
  const token =
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ema_token") : null) ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("ema_token") : null) ||
    authState.token;
  const username =
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("ema_username") : null) ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("ema_username") : null) ||
    authState.username;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(username ? { "x-username": username } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      `Backend Request Failed (${response.status}): ${errorText || response.statusText}`,
      url
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (text.trim().startsWith("<") || (contentType && !contentType.includes("application/json") && text.trim().startsWith("<!DOCTYPE"))) {
    throw new ApiError(
      502,
      `Backend Request Failed (HTML Fallback): Endpoint '${url}' returned HTML instead of JSON (Vercel SPA rewrite).`,
      url
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, `Backend Request Failed: Response from '${url}' was not valid JSON.`, url);
  }
}

export * from "./project";
export * from "./review";
export * from "./transform";
export * from "./report";
