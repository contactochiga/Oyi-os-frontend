// src/services/api.ts
import axios from "axios";
import { getConsumerApiBaseURL } from "./apiBase";

let lastLoggedBaseURL: string | null = null;

/**
 * Normalize backend URL
 */
function getBaseURL() {
  return getConsumerApiBaseURL();
}

function logResolvedBaseURL(reason: string, url: string) {
  if (typeof window === "undefined") return;
  if (lastLoggedBaseURL === `${reason}:${url}`) return;
  lastLoggedBaseURL = `${reason}:${url}`;
  console.info("[consumer.api.base]", {
    reason,
    baseURL: url,
    runtime: runtimeLabel(),
    location: window.location.href,
  });
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
 * Safe localStorage read
 */
function getLS(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * In-memory token (works great for iOS WebView)
 */
let memToken: string | null = null;

function runtimeLabel() {
  if (typeof window === "undefined") return "server";
  const capacitor = (window as any)?.Capacitor;
  if (capacitor?.isNativePlatform?.()) {
    return `native:${String(capacitor.getPlatform?.() || "unknown")}`;
  }
  return "web";
}

function networkMessage(error: any) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  if (status === 401) return "Authentication service unavailable.";
  if (status >= 500) return "Cannot reach Oyi right now.";
  if (message.includes("network error")) return "Cannot reach Oyi.";
  if (code === "econnaborted" || message.includes("timeout")) return "Request timed out.";
  if (!error?.response) return "Internet connection unavailable.";
  return String(error?.response?.data?.error || error?.response?.data?.message || error?.message || "Request failed");
}

/**
 * ✅ One source of truth setter
 */
export function setApiAuthToken(token: string | null) {
  memToken = token;

  if (token) {
    API.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    // remove default header
    delete API.defaults.headers.common.Authorization;
  }
}

/**
 * Axios instance
 */
const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Ochiga-Surface": "consumer",
  },
  timeout: 45000,
});

/**
 * Attach JWT automatically
 * Priority:
 * 1) in-memory (setApiAuthToken)
 * 2) localStorage (iOS)
 * 3) cookie (web)
 */
API.interceptors.request.use((config) => {
  config.baseURL = getBaseURL();
  logResolvedBaseURL("request", String(config.baseURL || ""));
  if (typeof window !== "undefined") {
    const lsToken =
      getLS("oyi_consumer_token_ls") || // ✅ your new key
      getLS("oyi_consumer_token") || // fallback
      null;

    const cookieToken = getCookie("oyi_consumer_token");

    const token = memToken || lsToken || cookieToken;

    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
      (config.headers as any)["X-Oyi-Contract-Version"] = "ochiga.tier1.2026-05-16";
    }
  }
  (config.headers as any)["X-Oyi-Runtime"] = runtimeLabel();

  return config;
});

export default API;


API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config: any = error?.config || {};
    const method = String(config.method || "get").toLowerCase();
    const timedOut = String(error?.code || "") === "ECONNABORTED" || /timeout/i.test(String(error?.message || ""));
    if (method === "get" && timedOut && !config.__oyiRetried) {
      config.__oyiRetried = true;
      return API.request(config);
    }
    const diagnostics = {
      method: String(config.method || "get").toUpperCase(),
      url: config?.url || null,
      baseURL: config?.baseURL || API.defaults.baseURL || null,
      runtime: runtimeLabel(),
      status: error?.response?.status || null,
      code: error?.code || null,
      category: !error?.response ? "network" : timedOut ? "timeout" : error?.response?.status >= 500 ? "server" : "request",
      selectedEnvironment: getBaseURL(),
    };
    (error as any).userMessage = networkMessage(error);
    (error as any).diagnostics = diagnostics;
    console.error("[consumer.api.request_failed]", diagnostics);
    return Promise.reject(error);
  },
);
