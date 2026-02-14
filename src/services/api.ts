import axios from "axios";

/**
 * Normalize backend URL
 */
function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

/**
 * In-memory token (works in Capacitor + Web)
 */
let MEMORY_TOKEN: string | null = null;

export function setApiAuthToken(token: string | null) {
  MEMORY_TOKEN = token;

  if (token) {
    API.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete API.defaults.headers.common.Authorization;
  }
}

/**
 * Cookie read (web-only helper)
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

const API = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

API.interceptors.request.use((config) => {
  // Prefer in-memory token first (Capacitor safe)
  const token = MEMORY_TOKEN || getCookie("oyi_consumer_token");

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default API;
