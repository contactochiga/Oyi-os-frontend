import API from "./api";

export type HomeAccessMember = {
  id: string;
  home_id: string;
  role?: string | null;
  status?: string | null;
  permissions?: Record<string, any> | null;
  created_at?: string | null;
  users?: {
    id: string;
    email?: string | null;
    full_name?: string | null;
    username?: string | null;
    role?: string | null;
  } | null;
};

export const homeAccessService = {
  async listHomeUsers(_homeId?: string): Promise<HomeAccessMember[]> {
    const res = await API.get("/home/members");
    return Array.isArray(res.data?.users) ? (res.data.users as HomeAccessMember[]) : [];
  },

  async inviteHomeUser(
    _homeId: string,
    input: { email: string; role?: string; permissions?: Record<string, any> }
  ) {
    const res = await API.post("/home/members/invite", input);
    return res.data as {
      message?: string;
      inviteUrl?: string;
      qrDataUrl?: string;
      membership?: HomeAccessMember | null;
    };
  },

  async updateHomeUser(
    membershipId: string,
    patch: {
      role?: string;
      status?: string;
      permissions?: Record<string, any>;
      full_name?: string;
      username?: string;
      email?: string;
    }
  ) {
    const res = await API.patch(`/home/members/${encodeURIComponent(membershipId)}`, patch);
    return res.data as { membership?: HomeAccessMember | null };
  },

  async removeHomeUser(membershipId: string) {
    const res = await API.delete(`/home/members/${encodeURIComponent(membershipId)}`);
    return res.data as { message?: string };
  },
};
