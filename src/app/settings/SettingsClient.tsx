// src/app/settings/SettingsClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { useSettingsStore } from "@/store/useSettingsStore";
import { deleteMyAccount, updateMyProfile } from "@/services/authService";
import API from "@/services/api";
import { roomsService, type RoomDTO } from "@/services/roomsService";
import { homeAccessService, type HomeAccessMember } from "@/services/homeAccessService";
import {
  getGenericIntegration,
  getTuyaIntegration,
  saveGenericIntegration,
  saveTuyaIntegration,
} from "@/services/integrationsService";

type AccessResident = {
  id: string;
  label: string;
  email?: string;
};

type AssistantIntegrationState = {
  provider: "alexa" | "google_assistant";
  label: string;
  placeholder: string;
  icon: string;
  alt: string;
  accentClassName: string;
  connected: boolean;
  masked: string | null;
  value: string;
  busy: boolean;
  error: string | null;
};

type AccountContextState = {
  estate?: { id: string; name: string } | null;
  home?: { id: string; name?: string | null; block?: string | null; unit?: string | null } | null;
  activeRole?: string | null;
  availableContexts?: Array<{
    estate_id: string;
    home_id: string;
    role?: string | null;
    status?: string | null;
  }>;
};

export default function SettingsClient() {
  const { user, token, setSession, logout } = useAuth();
  const params = useSearchParams();

  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const { notificationsEnabled, voiceEnabled, toggleNotifications, toggleVoice } = useSettingsStore();

  const [editOpen, setEditOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [residents, setResidents] = useState<AccessResident[]>([]);
  const [homeMembers, setHomeMembers] = useState<HomeAccessMember[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const [assigningAccess, setAssigningAccess] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [customResidentId, setCustomResidentId] = useState("");
  const [assignRole, setAssignRole] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [permissions, setPermissions] = useState({
    control_devices: true,
    manage_visitors: false,
    post_community: true,
    view_finance: false,
  });
  const [tuyaUid, setTuyaUid] = useState("");
  const [tuyaMasked, setTuyaMasked] = useState<string | null>(null);
  const [tuyaConnected, setTuyaConnected] = useState(false);
  const [tuyaBusy, setTuyaBusy] = useState(false);
  const [tuyaError, setTuyaError] = useState<string | null>(null);
  const [assistantIntegrations, setAssistantIntegrations] = useState<Record<"alexa" | "google_assistant", AssistantIntegrationState>>({
    alexa: {
      provider: "alexa",
      label: "Amazon Alexa",
      placeholder: "Enter your Alexa account ID",
      icon: "https://cdn.simpleicons.org/amazonalexa/00CAFF",
      alt: "Alexa",
      accentClassName: "border-sky-400/30 bg-sky-500/10",
      connected: false,
      masked: null,
      value: "",
      busy: false,
      error: null,
    },
    google_assistant: {
      provider: "google_assistant",
      label: "Google Assistant",
      placeholder: "Enter your Google Assistant home ID",
      icon: "https://cdn.simpleicons.org/googleassistant/34A853",
      alt: "Google Assistant",
      accentClassName: "border-emerald-400/30 bg-emerald-500/10",
      connected: false,
      masked: null,
      value: "",
      busy: false,
      error: null,
    },
  });
  const [accountContext, setAccountContext] = useState<AccountContextState>({});
  const unitLabel =
    accountContext.home?.name ||
    [accountContext.home?.block, accountContext.home?.unit].filter(Boolean).join(" ") ||
    (user as any)?.unit_name ||
    "—";

  const initials = useMemo(() => {
    const u = (user as any)?.username || (user as any)?.name || "User";
    return String(u).trim().charAt(0).toUpperCase() || "U";
  }, [user]);

  const role = String((user as any)?.role || "resident").toLowerCase();
  const activeHomeRole = String(accountContext.activeRole || "").toLowerCase();
  const canManageAccess = ["admin", "estate_admin", "owner", "manager", "operator"].includes(activeHomeRole || role);
  /* --------------------------------
     AUTO SCROLL BASED ON ENTRY
  --------------------------------- */
  useEffect(() => {
    const section = params.get("section");
    if (section === "settings") {
      settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [params]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await API.get("/me/context");
        const payload = (res?.data || {}) as any;
        const availableContexts = Array.isArray(payload?.available_contexts) ? payload.available_contexts : [];
        const activeContext = availableContexts.find(
          (ctx: any) =>
            String(ctx?.estate_id || "") === String(payload?.estate_id || "") &&
            String(ctx?.home_id || "") === String(payload?.home_id || "")
        );
        setAccountContext({
          estate: payload?.estate || null,
          home: payload?.home || null,
          activeRole: activeContext?.role ? String(activeContext.role) : null,
          availableContexts,
        });
      } catch {
        setAccountContext({});
      }
    };
    run();
  }, []);

  useEffect(() => {
    const homeId =
      accountContext.home?.id ||
      (user as any)?.home_id ||
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null);

    if (!homeId) return;

    const run = async () => {
      setAccessLoading(true);
      setAccessError(null);
      setAccessNotice(null);
      try {
        const [roomList, memberList] = await Promise.all([
          roomsService.getRooms(String(homeId)),
          homeAccessService.listHomeUsers(String(homeId)).catch(() => []),
        ]);

        setRooms(Array.isArray(roomList) ? roomList : []);
        setHomeMembers(Array.isArray(memberList) ? memberList : []);
        const parsedResidents = (Array.isArray(memberList) ? memberList : [])
          .map((member: any) => {
            const linkedUser = member?.users || {};
            const id = String(linkedUser?.id || "").trim();
            if (!id) return null;
            const label =
              linkedUser?.full_name ||
              linkedUser?.username ||
              linkedUser?.email ||
              `Resident ${id.slice(0, 6)}`;
            return {
              id,
              label: String(label),
              email: linkedUser?.email ? String(linkedUser.email) : undefined,
            };
          })
          .filter(Boolean) as AccessResident[];
        setResidents(parsedResidents);

        if (Array.isArray(roomList) && roomList[0]?.id) {
          setSelectedRoomId(String(roomList[0].id));
        }
      } catch (e: any) {
        setAccessError(e?.response?.data?.error || e?.message || "Failed to load access manager");
      } finally {
        setAccessLoading(false);
      }
    };

    run();
  }, [accountContext.home?.id, user]);

  useEffect(() => {
    const run = async () => {
      const res: any = await getTuyaIntegration();
      if (res?.error) return;
      setTuyaConnected(!!res?.connected);
      setTuyaMasked(res?.masked_uid || null);
      setTuyaUid(String(res?.tuya_uid || ""));
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      const providers: Array<"alexa" | "google_assistant"> = ["alexa", "google_assistant"];
      const results = await Promise.all(providers.map((provider) => getGenericIntegration(provider)));

      setAssistantIntegrations((prev) => {
        const next = { ...prev };
        providers.forEach((provider, index) => {
          const res: any = results[index];
          if (res?.error) {
            next[provider] = { ...next[provider], error: String(res.error) };
            return;
          }
          next[provider] = {
            ...next[provider],
            connected: !!res?.connected,
            masked: res?.masked_external_user_id || null,
            value: String(res?.external_user_id || ""),
            error: null,
          };
        });
        return next;
      });
    };
    run();
  }, []);

  function togglePermission(key: keyof typeof permissions) {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function assignRoomAccess() {
    if (!selectedRoomId) {
      setAccessError("Select a room first");
      return;
    }

    const residentId = selectedResidentId || customResidentId.trim();
    if (!residentId) {
      setAccessError("Select a resident or enter resident ID");
      return;
    }

    setAssigningAccess(true);
    setAccessError(null);
    try {
      await roomsService.assignUserToRoom({
        room_id: selectedRoomId,
        resident_id: residentId,
        role: assignRole,
        permissions,
      });

      setRooms((prev) =>
        prev.map((r) => {
          if (String(r.id) !== String(selectedRoomId)) return r;
          const nextAssignment = {
            resident_id: residentId,
            role: assignRole,
            permissions,
            created_at: new Date().toISOString(),
          };
          const existing = Array.isArray((r as any).room_assignments) ? (r as any).room_assignments : [];
          return { ...r, room_assignments: [nextAssignment, ...existing] };
        })
      );

      setCustomResidentId("");
      setAccessNotice("Room access updated.");
    } catch (e: any) {
      setAccessError(e?.response?.data?.error || e?.message || "Failed to assign resident to room");
    } finally {
      setAssigningAccess(false);
    }
  }

  async function inviteResidentToHome() {
    const homeId = String(accountContext.home?.id || "").trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!homeId) {
      setAccessError("No active home selected");
      return;
    }
    if (!email || !email.includes("@")) {
      setAccessError("Enter a valid email address");
      return;
    }

    setInviteBusy(true);
    setAccessError(null);
    setAccessNotice(null);
    try {
      const res = await homeAccessService.inviteHomeUser(homeId, {
        email,
        role: inviteRole,
        permissions,
      });
      setInviteEmail("");
      setLatestInviteUrl(res?.inviteUrl || null);
      setAccessNotice("Resident invite sent to this home.");
      const nextMembers = await homeAccessService.listHomeUsers(homeId).catch(() => []);
      setHomeMembers(Array.isArray(nextMembers) ? nextMembers : []);
      setResidents(
        (Array.isArray(nextMembers) ? nextMembers : [])
          .map((member: any) => {
            const linkedUser = member?.users || {};
            const id = String(linkedUser?.id || "").trim();
            if (!id) return null;
            return {
              id,
              label: String(linkedUser?.full_name || linkedUser?.username || linkedUser?.email || `Resident ${id.slice(0, 6)}`),
              email: linkedUser?.email ? String(linkedUser.email) : undefined,
            };
          })
          .filter(Boolean) as AccessResident[]
      );
    } catch (e: any) {
      setAccessError(e?.response?.data?.error || e?.message || "Failed to invite resident");
    } finally {
      setInviteBusy(false);
    }
  }

  async function saveTuyaUid() {
    if (!tuyaUid.trim()) {
      setTuyaError("Tuya UID is required");
      return;
    }
    setTuyaBusy(true);
    setTuyaError(null);
    const res: any = await saveTuyaIntegration(tuyaUid.trim());
    setTuyaBusy(false);
    if (res?.error) {
      setTuyaError(String(res.error));
      return;
    }
    setTuyaConnected(true);
    setTuyaMasked(`${tuyaUid.trim().slice(0, 4)}***${tuyaUid.trim().slice(-3)}`);
  }

  function updateAssistantValue(provider: "alexa" | "google_assistant", value: string) {
    setAssistantIntegrations((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], value, error: null },
    }));
  }

  async function saveAssistantIntegration(provider: "alexa" | "google_assistant") {
    const current = assistantIntegrations[provider];
    const nextValue = current.value.trim();
    if (!nextValue) {
      setAssistantIntegrations((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], error: "Account ID is required" },
      }));
      return;
    }

    setAssistantIntegrations((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], busy: true, error: null },
    }));

    const res: any = await saveGenericIntegration(provider, nextValue);

    setAssistantIntegrations((prev) => ({
      ...prev,
      [provider]: res?.error
        ? { ...prev[provider], busy: false, error: String(res.error) }
        : {
            ...prev[provider],
            busy: false,
            connected: true,
            masked: res?.masked_external_user_id || null,
            value: nextValue,
            error: null,
          },
    }));
  }

  return (
    <div className="relative z-10 max-w-3xl mx-auto py-2 space-y-10">
      {/* PROFILE HEADER */}
      <section ref={profileRef} className="text-center space-y-4">
        <div
          className="w-20 h-20 rounded-full bg-[#16A34A] mx-auto flex items-center justify-center text-white text-2xl font-semibold"
          aria-label="Profile avatar"
        >
          {initials}
        </div>

        <div>
          <div className="text-xl font-semibold text-white">{user?.username ?? "Resident"}</div>
          <div className="text-sm text-gray-400">{user?.email}</div>
        </div>

        {/* ✅ FIX: Make button actually do something */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="px-4 py-2 rounded-full border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition active:scale-[0.99]"
        >
          Edit profile
        </button>
      </section>

      {/* ACCOUNT */}
      <section className="space-y-4">
        <h3 className="text-sm text-gray-400">Account</h3>

        <Row label="Email" value={user?.email} />
        <Row label="Estate" value={accountContext.estate?.name ?? (user as any)?.estate_name ?? "—"} />
        <Row label="Unit" value={unitLabel} />
        <Row label="Role" value={user?.role ?? "resident"} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm text-gray-400">Smart Home Integration</h3>
        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
          <div className="text-xs text-gray-400">Manage partner integrations for full ecosystem control.</div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
              <div className="flex items-center gap-2">
                <img
                  src="https://cdn.simpleicons.org/tuya/ffffff"
                  alt="Tuya"
                  className="h-5 w-5"
                />
                <div className="text-sm font-semibold text-white">Tuya / Smart Life</div>
              </div>
              <div className="mt-1 text-[11px] text-white/65">
                {tuyaConnected ? `Connected (${tuyaMasked || "linked"})` : "Not connected"}
              </div>
            </div>

            {(["alexa", "google_assistant"] as const).map((provider) => {
              const integration = assistantIntegrations[provider];
              return (
                <div
                  key={provider}
                  className={`rounded-xl border p-3 ${integration.connected ? integration.accentClassName : "border-white/10 bg-black/30"}`}
                >
                  <div className="flex items-center gap-2">
                    <img src={integration.icon} alt={integration.alt} className="h-5 w-5" />
                    <div className="text-sm font-semibold text-white">{integration.label}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-white/65">
                    {integration.connected ? `Connected (${integration.masked || "linked"})` : "Not connected"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-gray-700 bg-black/30 p-3 space-y-2">
            <div className="text-xs text-gray-400">
              Link your own Tuya UID. Discovery and control will stay scoped to your home.
            </div>
            <input
              value={tuyaUid}
              onChange={(e) => setTuyaUid(e.target.value)}
              placeholder="Enter your Tuya UID"
              className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={saveTuyaUid}
              disabled={tuyaBusy || !tuyaUid.trim()}
              className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
            >
              {tuyaBusy ? "Saving..." : "Save Tuya UID"}
            </button>
            {tuyaError ? <div className="text-xs text-red-300">{tuyaError}</div> : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(["alexa", "google_assistant"] as const).map((provider) => {
              const integration = assistantIntegrations[provider];
              return (
                <div key={`${provider}-form`} className="rounded-xl border border-gray-700 bg-black/30 p-3 space-y-2">
                  <div className="text-xs text-gray-400">
                    Save the account identifier you want OYI to use when syncing assistant routines for this home.
                  </div>
                  <input
                    value={integration.value}
                    onChange={(e) => updateAssistantValue(provider, e.target.value)}
                    placeholder={integration.placeholder}
                    className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveAssistantIntegration(provider)}
                    disabled={integration.busy || !integration.value.trim()}
                    className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
                  >
                    {integration.busy ? "Saving..." : `Save ${integration.label}`}
                  </button>
                  {integration.error ? <div className="text-xs text-red-300">{integration.error}</div> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm text-gray-400">Room Access Control</h3>

        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
          <div className="text-xs text-gray-400">
            Manage who belongs to this home, then assign room-level control for devices, visitors, and finance visibility.
          </div>

          {!canManageAccess ? (
            <div className="text-sm text-gray-400">
              Access assignment is available to the active home owner or estate operations for this home.
            </div>
          ) : accessLoading ? (
            <div className="text-sm text-gray-400">Loading access manager…</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Home members</div>
                    <div className="text-xs text-gray-400">
                      Invite residents into {unitLabel === "—" ? "this home" : unitLabel} and keep the access list clean.
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                    {homeMembers.length} member(s)
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1.6fr_1fr]">
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Invite by email"
                    className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
                  >
                    <option value="member">Member</option>
                    <option value="owner">Owner</option>
                    <option value="viewer">Viewer</option>
                    <option value="guest">Guest</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={inviteResidentToHome}
                  disabled={inviteBusy}
                  className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
                >
                  {inviteBusy ? "Sending invite..." : "Invite Resident to Home"}
                </button>

                {latestInviteUrl ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 break-all">
                    Invite link generated: {latestInviteUrl}
                  </div>
                ) : null}

                <div className="space-y-2">
                  {homeMembers.length > 0 ? (
                    homeMembers.map((member) => {
                      const linkedUser = member.users || null;
                      const memberLabel =
                        linkedUser?.full_name ||
                        linkedUser?.username ||
                        linkedUser?.email ||
                        "Resident";
                      return (
                        <div
                          key={String(member.id)}
                          className="rounded-xl border border-gray-800 bg-black/20 px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white truncate">{memberLabel}</div>
                              <div className="text-xs text-gray-400 truncate">
                                {linkedUser?.email || "No email attached"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs uppercase tracking-wide text-white/70">
                                {String(member.role || "member")}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {String(member.status || "pending")}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-gray-800 bg-black/20 px-3 py-3 text-xs text-gray-400">
                      No home members linked yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                <div className="text-sm font-semibold text-white">Room permissions</div>
                <div className="text-xs text-gray-400">
                  Assign existing home members to rooms and define what they can operate.
                </div>

              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || `Room ${r.id}`}
                  </option>
                ))}
              </select>

              <select
                value={selectedResidentId}
                onChange={(e) => setSelectedResidentId(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select resident</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.email ? ` (${r.email})` : ""}
                  </option>
                ))}
              </select>

              <input
                value={customResidentId}
                onChange={(e) => setCustomResidentId(e.target.value)}
                placeholder="Or paste resident ID manually"
                className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
              />

              <select
                value={assignRole}
                onChange={(e) => setAssignRole(e.target.value)}
                className="w-full rounded-xl bg-black/30 border border-gray-700 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="member">Member</option>
                <option value="room_manager">Room Manager</option>
                <option value="viewer">Viewer</option>
              </select>

              <div className="grid grid-cols-2 gap-2">
                <PermissionToggle
                  label="Control devices"
                  enabled={permissions.control_devices}
                  onToggle={() => togglePermission("control_devices")}
                />
                <PermissionToggle
                  label="Manage visitors"
                  enabled={permissions.manage_visitors}
                  onToggle={() => togglePermission("manage_visitors")}
                />
                <PermissionToggle
                  label="Post community"
                  enabled={permissions.post_community}
                  onToggle={() => togglePermission("post_community")}
                />
                <PermissionToggle
                  label="View finance"
                  enabled={permissions.view_finance}
                  onToggle={() => togglePermission("view_finance")}
                />
              </div>

              <button
                type="button"
                onClick={assignRoomAccess}
                disabled={assigningAccess}
                className="w-full py-3 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50"
              >
                {assigningAccess ? "Applying access..." : "Assign Room Access"}
              </button>
              </div>

              {accessNotice ? <div className="text-xs text-emerald-300">{accessNotice}</div> : null}
              {accessError ? <div className="text-xs text-red-300">{accessError}</div> : null}
            </>
          )}
        </div>

        {canManageAccess ? (
          <div className="space-y-2">
            {(rooms.find((r) => String(r.id) === String(selectedRoomId))?.room_assignments || []).length > 0 ? (
              ((rooms.find((r) => String(r.id) === String(selectedRoomId))?.room_assignments || []) as any[]).map((a, idx) => (
                <div key={`${a?.resident_id || a?.user_id || idx}`} className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2">
                  <div className="text-xs text-white/90">
                    Resident: {String(a?.resident_id || a?.user_id || "—")}
                  </div>
                  <div className="text-[11px] text-white/50">
                    Role: {String(a?.role || "member")}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400">
                No room assignments yet for the selected room.
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* SETTINGS */}
      <section ref={settingsRef} className="space-y-4">
        <h3 className="text-sm text-gray-400">Preferences</h3>

        <ToggleRow label="Notifications" value={notificationsEnabled} onChange={toggleNotifications} />
        <ToggleRow label="Voice assistant" value={voiceEnabled} onChange={toggleVoice} />
      </section>

      {/* SYSTEM */}
      <section className="space-y-4">
        <h3 className="text-sm text-gray-400">System</h3>

        <Row label="App version" value="v1.0.0" />
        <Row label="Environment" value="Production" />
      </section>

      {/* LOGOUT */}
      <section className="pt-6 border-t border-gray-800">
        <button
          type="button"
          onClick={logout}
          className="w-full py-3 rounded-xl text-[#E11D2E] font-medium hover:bg-red-600/10 transition active:scale-[0.99]"
        >
          Log out
        </button>
      </section>

      {/* DELETE ACCOUNT */}
      <section className="space-y-3">
        <h3 className="text-sm text-gray-400">Privacy</h3>
        <div className="bg-[#1b0b0d] border border-red-900/60 rounded-xl p-4 space-y-3">
          <div className="text-sm text-red-200 font-medium">Delete account</div>
          <p className="text-xs text-red-300/80">
            This permanently removes your account and cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="w-full py-3 rounded-xl border border-red-500/50 text-red-300 hover:bg-red-500/10 transition active:scale-[0.99]"
          >
            Delete my account
          </button>
        </div>
      </section>

      <EditProfileModal
        open={editOpen}
        loading={savingProfile}
        error={profileError}
        onClose={() => {
          if (savingProfile) return;
          setProfileError(null);
          setEditOpen(false);
        }}
        onSave={async (nextName) => {
          setSavingProfile(true);
          setProfileError(null);
          const name = nextName.trim();

          const result = await updateMyProfile({
            username: name,
            full_name: name,
          });

          setSavingProfile(false);

          if (result?.error) {
            setProfileError(String(result.error));
            return;
          }

          if (result?.user && token) {
            setSession(token, {
              ...(user || {}),
              ...(result.user || {}),
            } as any);
          }

          setEditOpen(false);
        }}
        user={{
          username: user?.username ?? "Resident",
          email: user?.email ?? "",
        }}
      />

      <DeleteAccountModal
        open={deleteOpen}
        loading={deleting}
        error={deleteError}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError(null);
          const result = await deleteMyAccount();
          setDeleting(false);

          if (result?.error) {
            setDeleteError(String(result.error));
            return;
          }

          setDeleteOpen(false);
          logout();
        }}
      />
    </div>
  );
}

/* --------------------------------
   SMALL REUSABLE ROWS
--------------------------------- */

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm text-gray-400 truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="w-full flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 active:scale-[0.995]"
      aria-pressed={value}
      aria-label={label}
    >
      <span className="text-sm text-gray-300">{label}</span>

      <div className={`w-11 h-6 rounded-full transition ${value ? "bg-[#16A34A]" : "bg-gray-700"}`}>
        <div className={`w-5 h-5 bg-white rounded-full mt-[2px] transition ${value ? "ml-[22px]" : "ml-[2px]"}`} />
      </div>
    </button>
  );
}

function PermissionToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-xl border px-3 py-2 text-xs text-left transition ${
        enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-gray-700 bg-black/30 text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

function EditProfileModal({
  open,
  loading,
  error,
  onClose,
  onSave,
  user,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (name: string) => void;
  user: { username: string; email: string };
}) {
  const [name, setName] = useState(user.username);

  useEffect(() => {
    if (open) setName(user.username);
  }, [open, user.username]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close edit profile modal"
      />

      {/* sheet */}
      <div
        className="absolute left-0 right-0 bottom-0 mx-auto max-w-3xl px-4"
        style={{ paddingBottom: "calc(10px + var(--sab))" }}
      >
        <div className="rounded-t-3xl border border-white/10 bg-[#0a0c12]/90 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Edit profile</div>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10"
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <label className="text-xs text-white/60">Username</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                placeholder="Your name"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Email</label>
              <input
                value={user.email}
                disabled
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white/60 outline-none"
              />
            </div>

            {error ? <div className="text-xs text-red-300">{error}</div> : null}

            <button
              type="button"
              onClick={() => onSave(name)}
              disabled={loading || !name.trim()}
              className="w-full mt-2 py-3 rounded-2xl bg-white text-black text-sm font-semibold hover:opacity-90 transition active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({
  open,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  if (!open) return null;

  const canDelete = confirmText.trim().toUpperCase() === "DELETE" && !loading;

  return (
    <div className="fixed inset-0 z-[210]">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close delete account modal"
      />

      <div
        className="absolute left-0 right-0 bottom-0 mx-auto max-w-3xl px-4"
        style={{ paddingBottom: "calc(10px + var(--sab))" }}
      >
        <div className="rounded-t-3xl border border-red-900/50 bg-[#120709]/95 backdrop-blur-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/50 flex items-center justify-between">
            <div className="text-sm font-semibold text-red-200">Delete account</div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
            >
              Close
            </button>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-xs text-red-200/90">
              Type <span className="font-semibold">DELETE</span> to confirm permanent account deletion.
            </p>

            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              placeholder="Type DELETE"
              autoCapitalize="characters"
            />

            {error ? <div className="text-xs text-red-300">{error}</div> : null}

            <button
              type="button"
              onClick={onConfirm}
              disabled={!canDelete}
              className="w-full mt-2 py-3 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Deleting..." : "Permanently delete account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
