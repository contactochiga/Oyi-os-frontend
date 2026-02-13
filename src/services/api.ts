// src/services/api.ts
import axios from "axios";
import { useSessionStore } from "@/store/useSessionStore";

function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

const API = axios.create({
  baseURL: getBaseURL(),
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// ✅ Attach JWT automatically (works on iOS + web)
API.interceptors.request.use((config) => {
  const storeToken =
    typeof window !== "undefined" ? useSessionStore.getState().token : null;

  const cookieToken =
    typeof window !== "undefined" ? getCookie("oyi_consumer_token") : null;

  const token = storeToken || cookieToken;

  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }

  return config;
});

export default API;
