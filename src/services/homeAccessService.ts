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
  async listHomeUsers(homeId: string): Promise<HomeAccessMember[]> {
    const res = await API.get(`/facility/homes/${encodeURIComponent(homeId)}/users`);
    return Array.isArray(res.data?.users) ? (res.data.users as HomeAccessMember[]) : [];
  },

  async inviteHomeUser(
    homeId: string,
    input: { email: string; role?: string; permissions?: Record<string, any> }
  ) {
    const res = await API.post(`/facility/homes/${encodeURIComponent(homeId)}/invite`, input);
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
    const res = await API.patch(`/facility/home-users/${encodeURIComponent(membershipId)}`, patch);
    return res.data as { membership?: HomeAccessMember | null };
  },

  async removeHomeUser(membershipId: string) {
    const res = await API.delete(`/facility/home-users/${encodeURIComponent(membershipId)}`);
    return res.data as { message?: string };
  },
};
