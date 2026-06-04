// src/services/api.ts
import axios from "axios";
import { getConsumerApiBaseURL } from "./apiBase";

/**
 * Normalize backend URL
 */
function getBaseURL() {
  return getConsumerApiBaseURL();
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
  headers: {
    "Content-Type": "application/json",
    "X-Ochiga-Surface": "consumer",
  },
  timeout: 15000,
});

/**
 * Attach JWT automatically
 * Priority:
 * 1) in-memory (setApiAuthToken)
 * 2) localStorage (iOS)
 * 3) cookie (web)
 */
API.interceptors.request.use((config) => {
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

  return config;
});

export default API;
