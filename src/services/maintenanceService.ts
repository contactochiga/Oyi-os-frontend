import API from "./api";

export type MaintenanceTicket = {
  id: string;
  estate_id?: string | null;
  home_id?: string | null;
  user_id?: string | null;

  title: string;
  description?: string | null;

  category: "electricity" | "water" | "security" | "device" | "general";
  priority?: "low" | "medium" | "high";

  status: "open" | "in_progress" | "resolved";
  created_at?: string;
  updated_at?: string;
};

export type CreateMaintenancePayload = {
  title: string;
  description?: string;
  category: MaintenanceTicket["category"];
  priority?: "low" | "medium" | "high";
};

export const maintenanceService = {
  // Resident/home app: get my maintenance requests
  async listMine(): Promise<MaintenanceTicket[]> {
    const res = await API.get("/maintenance");
    // accept either { tickets: [] } or direct []
    return res.data?.tickets ?? res.data ?? [];
  },

  // Resident/home app: create request
  async create(payload: CreateMaintenancePayload) {
    const res = await API.post("/maintenance", payload);
    return res.data;
  },
};
