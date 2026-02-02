// src/services/maintenanceService.ts
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "https://oyi-os.onrender.com";

// If you already have a shared axios instance (recommended), use it instead.
// The key thing: send cookies + Authorization when you have it.
const http = axios.create({
  baseURL: API,
  withCredentials: true,
});

function getToken() {
  if (typeof window === "undefined") return null;
  return (
    document.cookie.match(/(?:^|; )oyi_consumer_token=([^;]*)/)?.[1] ||
    localStorage.getItem("oyi_consumer_token") ||
    localStorage.getItem("token") ||
    null
  );
}

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${decodeURIComponent(t)}`;
  return config;
});

export const maintenanceService = {
  async listMyMaintenance(params?: { status?: string }) {
    const res = await http.get("/maintenance", { params });
    return res.data?.requests || [];
  },

  async createMaintenance(payload: {
    home_id?: string | null;
    title: string;
    description?: string;
    priority?: "low" | "normal" | "high";
  }) {
    const res = await http.post("/maintenance", payload);
    return res.data?.request;
  },
};
