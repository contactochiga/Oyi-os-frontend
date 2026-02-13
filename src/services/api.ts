// src/services/api.ts
import axios from "axios";

/**
 * Normalize backend URL
 * - prevents double slashes
 * - guarantees fallback in dev
 */
function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

/**
 * Read cookie safely in browser
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/**
 * Axios instance
 */
const API = axios.create({
  baseURL: getBaseURL(),
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

/**
 * ✅ allow app to set auth token explicitly (needed on iOS WebView)
 */
export function setApiAuthToken(token: string | null) {
  if (token) {
    API.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common.Authorization;
  }
}

/**
 * Attach JWT automatically
 * Source of truth:
 * - cookie (web)
 * - OR explicit setApiAuthToken(token) (ios webview)
 */
API.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  // if already set explicitly, keep it
  const hasAuth =
    typeof (config.headers as any).Authorization === "string" &&
    (config.headers as any).Authorization.length > 0;

  if (!hasAuth && typeof window !== "undefined") {
    const token = getCookie("oyi_consumer_token");
    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export default API;
