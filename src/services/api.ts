import axios from "axios";
import { useSessionStore } from "@/store/useSessionStore";

function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

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

// ✅ set default auth header explicitly
export function setApiAuthToken(token: string | null) {
  if (!token) {
    delete API.defaults.headers.common.Authorization;
    return;
  }
  API.defaults.headers.common.Authorization = `Bearer ${token}`;
}

// ✅ keep interceptor as a safety-net
API.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const storeToken = useSessionStore.getState().token;
    const cookieToken = getCookie("oyi_consumer_token");
    const token = storeToken || cookieToken;

    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default API;
