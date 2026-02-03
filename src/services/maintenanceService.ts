import axios from "axios";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://oyi-os.onrender.com";

function getToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("oyi_consumer_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("oyi_facility_token") ||
    null
  );
}

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type MaintenanceStatus = "open" | "in_progress" | "resolved";

export type MaintenanceTicket = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority?: string | null;
  status: MaintenanceStatus;
  created_at?: string;
  home_id?: string | null;
  estate_id?: string;
};

export const maintenanceService = {
  // ✅ MATCH BACKEND: GET /maintenance?status=open
  async listMine(params?: { status?: string }) {
    const { data } = await http.get("/maintenance", { params });
    return (data?.requests || []) as MaintenanceTicket[];
  },

  // ✅ MATCH BACKEND: POST /maintenance
  async create(payload: {
    home_id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }) {
    const { data } = await http.post("/maintenance", payload);
    return data?.request as MaintenanceTicket;
  },

  // ✅ Backward-compat (in case some UI still calls these)
  async listMyTickets(params?: { status?: string }) {
    return this.listMine(params);
  },

  async createTicket(payload: {
    home_id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }) {
    return this.create(payload);
  },
};

export default maintenanceService;
