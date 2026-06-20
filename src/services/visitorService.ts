// src/services/visitorService.ts
import API from "./api";

export type VisitorStatus =
  | "active"
  | "approved"
  | "denied"
  | "entered"
  | "exited"
  | string;

export type VisitorAccess = {
  id: string;
  estate_id: string;
  home_id: string;
  created_by: string;
  resident_id?: string | null;

  visitor_name: string;
  visitor_phone: string;
  purpose?: string | null;

  access_code: string;
  status: VisitorStatus;

  navigation_mode?: string | null;
  expires_at?: string | null;
  created_at: string;

  // optional if you later add
  qr_s3_url?: string | null;
};

export type CreateVisitorPayload = {
  name: string;
  phone: string;
  purpose?: string;
  navigation_mode?: "code" | "link";
  expires_hours?: number; // optional
};

export type CreateVisitorResponse = {
  ok: boolean;
  visitor: VisitorAccess;
  link?: string | null;
  code?: string | null;
  qr?: string | null;
};

function pickError(err: any, fallback: string) {
  const status = Number(err?.response?.status || 0);
  const message = String(err?.response?.data?.error || err?.response?.data?.message || err?.message || "").trim();
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have access to this visitor operation.";
  if (status === 404) return "That visitor record is no longer available.";
  if (/supabase|postgres|database|relation|column|schema|jwt|sql/i.test(message)) return fallback;
  return message && message.length < 180 ? message : fallback;
}

export const visitorService = {
  /**
   * POST /visitors
   * backend expects: { name, phone, purpose?, navigation_mode?, expires_hours? }
   * estate/home context comes from req.user (token)
   */
  async create(payload: CreateVisitorPayload) {
    try {
      const res = await API.post("/visitors", payload);
      return res.data as CreateVisitorResponse;
    } catch (err: any) {
      return { error: pickError(err, "Failed to create visitor") } as any;
    }
  },

  /**
   * GET /visitors/info/:id
   */
  async getInfo(id: string) {
    try {
      const res = await API.get(`/visitors/info/${id}`);
      return res.data as { visitor: VisitorAccess };
    } catch (err: any) {
      return { error: pickError(err, "Failed to load visitor info") } as any;
    }
  },

  /**
   * OPTIONAL (only if you add backend route later)
   * GET /visitors/mine
   */
  async listMine() {
    try {
      const res = await API.get("/visitors/mine");
      // accept either { items: [] } or raw []
      return (res.data?.items || res.data || []) as VisitorAccess[];
    } catch {
      // If route doesn't exist yet, don't break UI
      return [] as VisitorAccess[];
    }
  },
};

export default visitorService;
