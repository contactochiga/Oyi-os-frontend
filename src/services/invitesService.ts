// src/services/invitesService.ts
import API from "./api";

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";
export type HomeRole = "resident" | "home_member" | "home_admin";

export type HomeInvite = {
  id: string;
  estate_id: string;
  home_id: string;
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
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

/**
 * GET /invites/mine
 * - backend matches by token email, so no args needed
 */
export async function listMyInvites() {
  try {
    const res = await API.get("/invites/mine");
    return res.data as { invites?: HomeInvite[] };
  } catch (err: any) {
    return { error: pickError(err, "Failed to load invites") };
  }
}

/**
 * POST /invites/:inviteId/accept
 */
export async function acceptInvite(inviteId: string) {
  try {
    const res = await API.post(`/invites/${inviteId}/accept`);
    return res.data as { ok?: boolean };
  } catch (err: any) {
    return { error: pickError(err, "Failed to accept invite") };
  }
}

/**
 * POST /invites/:inviteId/decline
 */
export async function declineInvite(inviteId: string) {
  try {
    const res = await API.post(`/invites/${inviteId}/decline`);
    return res.data as { ok?: boolean };
  } catch (err: any) {
    return { error: pickError(err, "Failed to decline invite") };
  }
}
