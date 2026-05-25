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
import { getOyiWatchSyncStatus, syncOyiWatchSession, type WatchSyncResult } from "@/services/watchSyncService";

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
  const [watchSyncBusy, setWatchSyncBusy] = useState(false);
  const [watchSyncMessage, setWatchSyncMessage] = useState<string | null>(null);
  const [watchSyncError, setWatchSyncError] = useState<string | null>(null);
  const [watchStatus, setWatchStatus] = useState<WatchSyncResult | null>(null);
  const [watchSyncOpen, setWatchSyncOpen] = useState(false);
  const [watchSyncStage, setWatchSyncStage] = useState<"idle" | "searching" | "securing" | "personalizing" | "complete" | "attention">("idle");
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

  async function refreshWatchStatus() {
    try {
      setWatchStatus(await getOyiWatchSyncStatus());
    } catch (error) {
      setWatchStatus({ available: false, lastSyncError: error instanceof Error ? error.message : "status_failed" });
    }
  }

  function openWatchSyncModule() {
    setWatchSyncOpen(true);
    setWatchSyncMessage(null);
    setWatchSyncError(null);
    if (watchSyncStage !== "complete") setWatchSyncStage("idle");
    void refreshWatchStatus();
  }

  async function syncWatchNow() {
    setWatchSyncOpen(true);
    setWatchSyncBusy(true);
    setWatchSyncStage("searching");
    setWatchSyncMessage(null);
    setWatchSyncError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 420));
      setWatchSyncStage("securing");
      await new Promise((resolve) => setTimeout(resolve, 420));
      setWatchSyncStage("personalizing");
      const result = await syncOyiWatchSession(token, user);
      if (result?.synced) {
        const installed = result.watchAppInstalled === false ? " Watch app not detected yet." : "";
        setWatchSyncStage("complete");
        setWatchSyncMessage(`Oyi Watch is personalized for this home.${installed}`);
        setWatchStatus(result);
      } else {
        setWatchSyncStage("attention");
        setWatchSyncError(
          result?.reason === "ios_native_only"
            ? "Watch sync requires the iPhone app. Please open Oyi Home on iPhone."
            : result?.reason === "missing_token"
              ? "Sign in again before syncing your watch."
              : "Watch sync did not complete. Keep the watch paired, unlocked, and nearby."
        );
      }
    } catch {
      setWatchSyncStage("attention");
      setWatchSyncError("Watch sync failed. Keep the watch paired, unlocked, and nearby.");
    } finally {
      setWatchSyncBusy(false);
      void refreshWatchStatus();
    }
  }

  useEffect(() => {
    void refreshWatchStatus();
  }, []);

  const activationLabel =
    watchStatus?.activationState === 2
      ? "activated"
      : watchStatus?.activationState === 1
        ? "inactive"
        : watchStatus?.activationState === 0
          ? "not activated"
          : "unknown";

  const watchIsAvailable = watchStatus?.available !== false;
  const watchIsInstalled = Boolean(watchStatus?.watchAppInstalled);
  const watchIsReachable = Boolean(watchStatus?.reachable);
  const watchExperience = getWatchExperience({
    stage: watchSyncStage,
    status: watchStatus,
    hasToken: Boolean(token),
  });

  return (
    <div className="oyi-living-page relative z-10 mx-auto max-w-3xl space-y-4 py-2 pb-8">
      {/* PROFILE HEADER */}
      <section ref={profileRef} className="oyi-environment-hero rounded-[24px] p-4 text-center">
        <div
          className="oyi-orb mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white"
          aria-label="Profile avatar"
        >
          {initials}
        </div>

        <div className="mt-4">
          <div className="text-lg font-semibold text-white">{user?.username ?? "Resident"}</div>
          <div className="text-xs text-white/45">{user?.email}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-sky-100/55">
            Identity aware • Home scoped • Permission protected
          </div>
        </div>

        {/* ✅ FIX: Make button actually do something */}
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="mt-4 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs text-white/70 transition hover:bg-white/10 active:scale-[0.99]"
        >
          Edit profile
        </button>
      </section>

      {/* ACCOUNT */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Access & Family</h3>

        <Row label="Email" value={user?.email} />
        <Row label="Estate" value={accountContext.estate?.name ?? (user as any)?.estate_name ?? "—"} />
        <Row label="Unit" value={unitLabel} />
        <Row label="Role" value={user?.role ?? "resident"} />
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Connected Systems</h3>
        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 space-y-3">
          <div className="text-xs text-gray-400">Manage partner integrations for full ecosystem control.</div>

          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Oyi Watch</div>
                <div className="mt-1 text-[11px] leading-relaxed text-white/60">
                  Pair your Apple Watch with this home and send your secure iPhone session.
                </div>
              </div>
              <div className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${watchExperience.badgeClass}`}>
                {watchExperience.badge}
              </div>
            </div>
            <button
              type="button"
              onClick={openWatchSyncModule}
              disabled={!token}
              className="w-full rounded-xl bg-white px-3 py-3 text-sm font-semibold text-black transition active:scale-[0.99] disabled:opacity-50"
            >
              Open Watch Sync
            </button>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-white/50">
              <WatchSignal label="Paired" active={Boolean(watchStatus?.paired)} />
              <WatchSignal label="Installed" active={watchIsInstalled} />
              <WatchSignal label="Session" active={Boolean(token)} value={token ? "ready" : "missing"} />
            </div>
            {watchSyncError ? <div className="text-xs text-amber-200">{watchSyncError}</div> : null}
          </div>

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

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Home Intelligence</h3>

        <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 space-y-3">
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
      <section ref={settingsRef} className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Preferences</h3>

        <ToggleRow label="Notifications" value={notificationsEnabled} onChange={toggleNotifications} />
        <ToggleRow label="Voice assistant" value={voiceEnabled} onChange={toggleVoice} />
      </section>

      {/* SYSTEM */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Security & Privacy</h3>

        <Row label="App version" value="v1.0.0" />
        <Row label="Environment" value="Production" />
      </section>

      {/* LOGOUT */}
      <section className="border-t border-white/10 pt-4">
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
        <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/38">Account Safety</h3>
        <div className="rounded-[20px] border border-red-900/40 bg-[#1b0b0d]/70 p-4 space-y-3">
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

      <WatchSyncModule
        open={watchSyncOpen}
        busy={watchSyncBusy}
        experience={watchExperience}
        status={watchStatus}
        activationLabel={activationLabel}
        hasToken={Boolean(token)}
        message={watchSyncMessage}
        error={watchSyncError}
        onClose={() => {
          if (watchSyncBusy) return;
          setWatchSyncOpen(false);
        }}
        onSync={syncWatchNow}
        onRefresh={refreshWatchStatus}
      />

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


function WatchSyncModule({
  open,
  busy,
  experience,
  status,
  activationLabel,
  hasToken,
  message,
  error,
  onClose,
  onSync,
  onRefresh,
}: {
  open: boolean;
  busy: boolean;
  experience: ReturnType<typeof getWatchExperience>;
  status: WatchSyncResult | null;
  activationLabel: string;
  hasToken: boolean;
  message: string | null;
  error: string | null;
  onClose: () => void;
  onSync: () => void;
  onRefresh: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Oyi Watch sync">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close watch sync" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[34px] border border-white/12 bg-[radial-gradient(circle_at_28%_5%,rgba(56,189,248,0.24),transparent_34%),linear-gradient(160deg,rgba(9,14,28,0.98),rgba(2,5,12,0.98))] p-5 text-center shadow-[0_36px_120px_rgba(0,0,0,0.72)]">
        <div className="pointer-events-none absolute -left-20 top-8 h-44 w-44 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/12 blur-3xl" />

        <div className="relative flex items-center justify-between text-left">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/45">Oyi Watch setup</div>
            <div className="mt-1 text-lg font-semibold text-white">{experience.title}</div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/60 disabled:opacity-40">
            Close
          </button>
        </div>

        <div className="relative mx-auto mt-6 h-56 w-44 rounded-[44px] border border-white/16 bg-black p-3 shadow-[inset_0_0_28px_rgba(255,255,255,0.05),0_0_70px_rgba(56,189,248,0.16)]">
          <div className="absolute -right-2 top-16 h-10 w-1.5 rounded-r-full bg-white/20" />
          <div className="flex h-full flex-col items-center justify-center rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.26),rgba(0,0,0,0.92)_58%)] px-4">
            <div className={`relative flex h-24 w-24 items-center justify-center rounded-full border ${experience.ringClass} bg-black/55 ${busy ? "animate-pulse" : ""}`}>
              <div className="absolute inset-2 rounded-full border border-sky-300/20" />
              <div className="absolute inset-0 rounded-full bg-sky-400/10 blur-xl" />
              <div className="relative text-xl font-semibold text-white">Oyi</div>
            </div>
            <div className="mt-4 text-sm font-medium text-sky-200">{experience.badge}</div>
            <div className="mt-1 text-[11px] text-white/50">{experience.kicker}</div>
          </div>
        </div>

        <p className="relative mx-auto mt-5 max-w-xs text-xs leading-relaxed text-white/58">{experience.summary}</p>

        <div className="relative mt-5 grid grid-cols-4 gap-2 text-left">
          {experience.steps.map((step, index) => (
            <div key={step.label} className="space-y-1">
              <div className={`h-1 rounded-full ${step.active ? "bg-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.8)]" : step.done ? "bg-emerald-300/85" : "bg-white/12"}`} />
              <div className={`text-[9px] ${step.active || step.done ? "text-white/72" : "text-white/28"}`}>{index + 1}. {step.label}</div>
            </div>
          ))}
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 text-left">
          <WatchSignal label="Paired" active={Boolean(status?.paired)} />
          <WatchSignal label="Installed" active={Boolean(status?.watchAppInstalled)} />
          <WatchSignal label="Reachable" active={Boolean(status?.reachable)} />
          <WatchSignal label="Activation" active={status?.activationState === 2} value={activationLabel} />
          <WatchSignal label="iPhone session" active={hasToken} value={hasToken ? "ready" : "missing"} />
          <WatchSignal label="Native app" active={status?.available !== false} />
        </div>

        {message ? <div className="relative mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">{message}</div> : null}
        {error ? <div className="relative mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">{error}</div> : null}
        {status?.lastSyncError || status?.lastActivationError ? (
          <div className="relative mt-2 text-[10px] text-white/36">Last sync detail: {status.lastSyncError || status.lastActivationError}</div>
        ) : null}

        <div className="relative mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onRefresh} disabled={busy} className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-medium text-white/70 disabled:opacity-40">
            Scan Again
          </button>
          <button type="button" onClick={onSync} disabled={busy || !hasToken} className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-45">
            {busy ? "Syncing" : "Sync Watch"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getWatchExperience({
  stage,
  status,
  hasToken,
}: {
  stage: "idle" | "searching" | "securing" | "personalizing" | "complete" | "attention";
  status: WatchSyncResult | null;
  hasToken: boolean;
}) {
  const nativeUnavailable = status?.available === false;
  const paired = Boolean(status?.paired);
  const installed = Boolean(status?.watchAppInstalled);
  const reachable = Boolean(status?.reachable);
  const stageOrder = ["searching", "securing", "personalizing", "complete"];
  const activeIndex = stageOrder.indexOf(stage);
  const makeSteps = (activeLabel: string) =>
    ["Find", "Secure", "Personalize", "Ready"].map((label, index) => ({
      label,
      active: label === activeLabel,
      done: activeIndex >= index && stage !== "attention",
    }));

  if (stage === "searching") {
    return {
      badge: "Searching",
      badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-100/80",
      ringClass: "border-sky-300/35",
      kicker: "Finding Apple Watch",
      title: "Looking for your paired watch nearby",
      summary: "Keep your iPhone and Apple Watch unlocked and close together.",
      steps: makeSteps("Find"),
    };
  }

  if (stage === "securing") {
    return {
      badge: "Securing",
      badgeClass: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100/80",
      ringClass: "border-cyan-300/35",
      kicker: "Preparing secure session",
      title: "Encrypting your home access for Oyi Watch",
      summary: "Oyi is sending only presence signals and a secure session token.",
      steps: makeSteps("Secure"),
    };
  }

  if (stage === "personalizing") {
    return {
      badge: "Personalizing",
      badgeClass: "border-indigo-300/20 bg-indigo-300/10 text-indigo-100/80",
      ringClass: "border-indigo-300/35",
      kicker: "Personalizing watch",
      title: "Applying your home, role, and permissions",
      summary: "Your watch receives the same protected home scope as your iPhone.",
      steps: makeSteps("Personalize"),
    };
  }

  if (stage === "complete") {
    return {
      badge: "Synced",
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/80",
      ringClass: "border-emerald-300/35",
      kicker: "Ready on wrist",
      title: "Oyi Watch is connected to this home",
      summary: "Open Oyi Watch to see Synced mode and run a safe quick action.",
      steps: makeSteps("Ready"),
    };
  }

  if (stage === "attention" || nativeUnavailable || !hasToken) {
    return {
      badge: "Needs attention",
      badgeClass: "border-amber-300/20 bg-amber-300/10 text-amber-100/80",
      ringClass: "border-amber-300/35",
      kicker: nativeUnavailable ? "iPhone app required" : !hasToken ? "Session required" : "Sync interrupted",
      title: nativeUnavailable
        ? "Open Oyi Home from the installed iPhone app"
        : !hasToken
          ? "Sign in again before syncing your watch"
          : "Keep both devices unlocked and nearby",
      summary: nativeUnavailable
        ? "Browser preview cannot use WatchConnectivity. This must run inside the iPhone app."
        : "The watch keeps Mock mode until it receives a synced token or a local dev token.",
      steps: ["Find", "Secure", "Personalize", "Ready"].map((label) => ({ label, active: false, done: false })),
    };
  }

  if (paired && installed && reachable) {
    return {
      badge: "Live",
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100/80",
      ringClass: "border-emerald-300/35",
      kicker: "Apple Watch detected",
      title: "Ready to sync your wrist experience",
      summary: "Your watch is nearby. Sync to personalize it for this home.",
      steps: ["Find", "Secure", "Personalize", "Ready"].map((label, index) => ({ label, active: index === 0, done: false })),
    };
  }

  return {
    badge: installed ? "Installed" : paired ? "Paired" : "Setup",
    badgeClass: "border-sky-300/20 bg-sky-300/10 text-sky-100/75",
    ringClass: "border-sky-300/25",
    kicker: installed ? "Watch app found" : paired ? "Paired watch found" : "Watch setup",
    title: installed ? "Wake Oyi Watch, then sync" : paired ? "Install Oyi Watch from the iPhone app" : "Pair an Apple Watch to continue",
    summary: "Sync sends your secure session and home context from iPhone to Watch.",
    steps: ["Find", "Secure", "Personalize", "Ready"].map((label) => ({ label, active: false, done: false })),
  };
}

function WatchSignal({ label, active, value }: { label: string; active: boolean; value?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-300" : "bg-white/22"}`} />
        <span className="text-white/38">{label}</span>
      </div>
      <div className="mt-1 text-[11px] text-white/78">{value || (active ? "yes" : "no")}</div>
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
