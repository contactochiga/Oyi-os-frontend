import axios from "axios";

// match your existing pattern
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://oyi-os.onrender.com";

function getToken() {
  if (typeof window === "undefined") return null;

  // same tokens you use elsewhere
  return (
    localStorage.getItem("oyi_consumer_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("oyi_facility_token") ||
    null
  );
}

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // ✅ so cookies work if you use them
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

// ✅ UI COMPAT exports (so your current page stops crashing)
export const maintenanceService = {
  // OLD UI NAMES (your page is calling these)
  async listMyTickets(params?: { status?: string; homeId?: string }) {
    const { data } = await http.get("/maintenance", { params });
    return (data?.requests || []) as MaintenanceTicket[];
  },

  async createTicket(payload: {
    home_id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }) {
    const { data } = await http.post("/maintenance", payload);
    return data?.request as MaintenanceTicket;
  },

  // NEW clearer aliases (use these going forward)
  async listMyMaintenance(params?: { status?: string; homeId?: string }) {
    return this.listMyTickets(params);
  },

  async createMaintenance(payload: {
    home_id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }) {
    return this.createTicket(payload);
  },
};

export default maintenanceService;
