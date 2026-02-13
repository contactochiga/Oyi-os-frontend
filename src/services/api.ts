// src/services/api.ts
import axios from "axios";
import { useSessionStore } from "@/store/useSessionStore";

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
 * Read cookie safely in browser (web fallback)
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
 * Attach JWT automatically
 * Source of truth:
 *  1) Zustand session store (works on iOS/Capacitor)
 *  2) Cookie fallback (works on web)
 */
API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const storeToken = useSessionStore.getState().token;
    const cookieToken = getCookie("oyi_consumer_token");

    const token = storeToken || cookieToken;

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export default API;
