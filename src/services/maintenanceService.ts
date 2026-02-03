// src/services/maintenanceService.ts
import API from "./api";

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

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const maintenanceService = {
  /**
   * GET /maintenance?status=open
   * backend returns: { requests: [...] }
   */
  async listMyTickets(params?: { status?: string; homeId?: string }) {
    try {
      const res = await API.get("/maintenance", { params });
      return (res.data?.requests || []) as MaintenanceTicket[];
    } catch (err: any) {
      return { error: pickError(err, "Failed to load maintenance") } as any;
    }
  },

  /**
   * POST /maintenance
   * backend returns: { request: {...} }
   */
  async createTicket(payload: {
    home_id?: string;
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }) {
    try {
      const res = await API.post("/maintenance", payload);
      return res.data?.request as MaintenanceTicket;
    } catch (err: any) {
      return { error: pickError(err, "Failed to create request") } as any;
    }
  },

  // aliases (optional)
  listMyMaintenance(params?: { status?: string; homeId?: string }) {
    return this.listMyTickets(params);
  },

  createMaintenance(payload: {
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
