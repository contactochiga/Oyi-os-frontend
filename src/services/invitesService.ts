// src/services/invitesService.ts
import API from "./api";

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";
export type HomeRole = "resident" | "home_member" | "home_admin";

export type HomeInvite = {
  id: string;
  estate_id: string | null;
  home_id: string | null;
  invited_email: string;
  role: HomeRole;
  status: InviteStatus;

  created_by?: string | null;
  created_at?: string | null;
  expires_at?: string | null;

  accepted_by?: string | null;
  accepted_at?: string | null;

  declined_by?: string | null;
  declined_at?: string | null;

  // ✅ optional enriched fields (if backend returns them)
  estate?: { id: string; name: string } | null;
  home?: { id: string; name: string | null; block: string | null; unit: string | null } | null;
  home_label?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export async function listMyInvites() {
  try {
    const res = await API.get("/invites/mine");
    return res.data as { ok?: boolean; invites?: HomeInvite[] };
  } catch (err: any) {
    return { error: pickError(err, "Failed to load invites") };
  }
}

/**
 * POST /invites/:inviteId/accept
 * ✅ backend returns: { ok: true, token, user, membership }
 */
export async function acceptInvite(inviteId: string) {
  try {
    const res = await API.post(`/invites/${inviteId}/accept`);
    return res.data as {
      ok?: boolean;
      token?: string;
      user?: any;
      membership?: any;
    };
  } catch (err: any) {
    return { error: pickError(err, "Failed to accept invite") };
  }
}

export async function declineInvite(inviteId: string) {
  try {
    const res = await API.post(`/invites/${inviteId}/decline`);
    return res.data as { ok?: boolean };
  } catch (err: any) {
    return { error: pickError(err, "Failed to decline invite") };
  }
}
