"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronRight,
  Edit3,
  HelpCircle,
  Home,
  LockKeyhole,
  LogOut,
  Plug,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";

import LayoutWrapper from "@/app/components/LayoutWrapper";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import BottomNav from "@/app/components/BottomNav";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { deleteMyAccount, removeMyProfileImage, updateMyProfile, uploadMyProfileImage } from "@/services/authService";
import { deviceService } from "@/services/deviceService";
import { homeAccessService, type HomeAccessMember } from "@/services/homeAccessService";
import { walletService } from "@/services/walletService";
import { getGenericIntegration, getTuyaIntegration } from "@/services/integrationsService";
import { describeOyiWatchStatus, getOyiWatchSyncStatus, isOyiWatchConnected, syncOyiWatchSession, type WatchSyncResult } from "@/services/watchSyncService";
import { listMyNotifications, type AppNotification } from "@/services/notificationsService";
import { useSettingsStore } from "@/store/useSettingsStore";
import API from "@/services/api";
import pkg from "../../../package.json";

type PanelKey =
  | "personal"
  | "access"
  | "security"
  | "notifications"
  | "integrations"
  | "preferences"
  | "support"
  | null;

type IntegrationStatus = {
  label: string;
  connected: boolean;
  detail?: string | null;
};

function asArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.devices)) return value.devices;
  if (Array.isArray(value?.users)) return value.users;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function fullName(user: any) {
  return String(user?.full_name || user?.name || user?.username || user?.email || "Resident").trim();
}

function initialsFor(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "O";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}

function homeLabel(home: any, fallback?: string | null) {
  const blockUnit = [home?.block, home?.unit].filter(Boolean).join(" ");
  return String(home?.name || blockUnit || fallback || "No active home").trim();
}

function appEnvironment() {
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || "development";
  if (env === "production") return "Production";
  if (env === "staging") return "Staging";
  return "Development";
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, logout, ready, setSession } = useAuth() as any;
  const active = useActiveContext();
  const { notificationsEnabled, voiceEnabled, darkMode } = useSettingsStore();

  const [devices, setDevices] = useState<any[]>([]);
  const [members, setMembers] = useState<HomeAccessMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("resident");
  const [accessBusy, setAccessBusy] = useState("");
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [watchStatus, setWatchStatus] = useState<WatchSyncResult | null>(null);
  const [watchSyncBusy, setWatchSyncBusy] = useState(false);
  const [watchSyncMessage, setWatchSyncMessage] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [panel, setPanel] = useState<PanelKey>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);

  const name = fullName(user);
  const email = String((user as any)?.email || "").trim();
  const phone = String((user as any)?.phone || (user as any)?.phone_number || "").trim();
  const avatarUrl = String((user as any)?.avatar_url || (user as any)?.profile_image_url || (user as any)?.image || "").trim();
  const displayedAvatarUrl = avatarPreview || avatarUrl;
  const verified = Boolean((user as any)?.email_verified || (user as any)?.verified || (user as any)?.is_verified);
  const verificationLabel = verified ? "Verified" : "Pending verification";
  const currentHome = homeLabel(active.home, (user as any)?.unit_name || (user as any)?.home_name);
  const unreadSecurity = notifications.filter((item) => item.status !== "read" && String(item.type || "").toLowerCase().includes("security")).length;
  const securityState = unreadSecurity ? "Attention Needed" : active.home_id ? "Protected" : "Pending Setup";
  const role = String((user as any)?.role || "resident");
  const currentMembership = members.find((member) => String(member.users?.id || "") === String((user as any)?.id || ""));
  const homeRole = String(currentMembership?.role || role || "resident").toLowerCase();
  const canManageMembers = ["owner", "admin"].includes(homeRole) || ["owner", "admin"].includes(role.toLowerCase());
  const address = String((user as any)?.address || active.home?.name || "").trim();

  useEffect(() => {
    setEditName(name);
    setEditUsername(String((user as any)?.username || "").trim());
    setEditPhone(phone);
  }, [name, phone, user]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    async function load() {
      const [deviceRes, memberRes, walletRes, notificationRes, watchRes] = await Promise.allSettled([
        deviceService.getAssignedDevices(active.estate_id || (user as any)?.estate_id),
        active.home_id ? homeAccessService.listHomeUsers(active.home_id) : Promise.resolve([]),
        walletService.getWallet(),
        listMyNotifications(),
        getOyiWatchSyncStatus().catch(() => null),
      ]);
      if (cancelled) return;
      if (deviceRes.status === "fulfilled") setDevices(asArray(deviceRes.value));
      if (memberRes.status === "fulfilled") setMembers(asArray<HomeAccessMember>(memberRes.value));
      if (walletRes.status === "fulfilled" && !(walletRes.value as any)?.error) {
        setWalletBalance(Number((walletRes.value as any)?.balance ?? 0));
      }
      if (notificationRes.status === "fulfilled") setNotifications(asArray<AppNotification>(notificationRes.value));
      if (watchRes.status === "fulfilled") setWatchStatus(watchRes.value || null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, token, active.estate_id, active.home_id, user]);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    async function loadIntegrations() {
      const next: IntegrationStatus[] = [];
      const [tuya, alexa, google, appleHome] = await Promise.allSettled([
        getTuyaIntegration(),
        getGenericIntegration("alexa"),
        getGenericIntegration("google_assistant"),
        API.get("/me/integrations/apple_home").then((res) => res.data).catch(() => ({ connected: false })),
      ]);
      if (cancelled) return;
      next.push({
        label: "Oyi Watch",
        connected: isOyiWatchConnected(watchStatus),
        detail: describeOyiWatchStatus(watchStatus),
      });
      const tuyaValue: any = tuya.status === "fulfilled" ? tuya.value : null;
      const alexaValue: any = alexa.status === "fulfilled" ? alexa.value : null;
      const googleValue: any = google.status === "fulfilled" ? google.value : null;
      const appleValue: any = appleHome.status === "fulfilled" ? appleHome.value : null;
      next.push({ label: "Tuya / Smart Life", connected: Boolean(tuyaValue?.connected), detail: tuyaValue?.masked_uid || null });
      next.push({ label: "Apple Home", connected: Boolean(appleValue?.connected), detail: appleValue?.masked_external_user_id || null });
      next.push({ label: "Google Home", connected: Boolean(googleValue?.connected), detail: googleValue?.masked_external_user_id || null });
      next.push({ label: "Alexa", connected: Boolean(alexaValue?.connected), detail: alexaValue?.masked_external_user_id || null });
      setIntegrations(next);
    }
    void loadIntegrations();
    return () => {
      cancelled = true;
    };
  }, [ready, token, watchStatus]);

  const overview = [
    { label: "Current Home", value: currentHome, icon: Home, tint: "text-sky-300" },
    { label: "Devices", value: String(devices.length), icon: Plug, tint: "text-emerald-300" },
    { label: "Members", value: String(members.length), icon: Users, tint: "text-violet-300" },
    { label: "Security", value: securityState, icon: ShieldCheck, tint: "text-amber-300" },
  ];

  const menu = [
    { key: "personal" as const, label: "Personal Information", body: "Name, email, phone", icon: User, color: "text-sky-300" },
    { key: "access" as const, label: "Homes & Access", body: "Manage your homes and permissions", icon: Home, color: "text-emerald-300" },
    { key: "security" as const, label: "Security", body: "Passwords, 2FA, and session management", icon: ShieldCheck, color: "text-violet-300" },
    { key: "notifications" as const, label: "Notifications", body: "Alert preferences and delivery", icon: Bell, color: "text-amber-300" },
    { key: "integrations" as const, label: "Integrations", body: "Connected services and devices", icon: Plug, color: "text-sky-300" },
    { key: "preferences" as const, label: "Preferences", body: "Units, language, appearance", icon: Settings, color: "text-white/55" },
    { key: "support" as const, label: "Help & Support", body: "FAQs, guides, and contact us", icon: HelpCircle, color: "text-white/55" },
  ];

  async function saveProfile() {
    setEditError(null);
    setEditBusy(true);
    const result = await updateMyProfile({
      full_name: editName.trim(),
      username: editUsername.trim() || undefined,
      phone: editPhone.trim() || undefined,
    });
    setEditBusy(false);
    if ((result as any)?.error) {
      setEditError(String((result as any).error));
      return;
    }
    const nextUser = {
      ...(user || {}),
      ...((result as any)?.user || {}),
      full_name: editName.trim(),
      username: editUsername.trim() || (user as any)?.username,
      phone: editPhone.trim(),
    };
    if (token && typeof setSession === "function") setSession(token, nextUser);
    setEditOpen(false);
  }

  function handleAvatarPicked(file: File | null) {
    setAvatarMessage(null);
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  async function saveAvatarImage() {
    if (!avatarFile) return;
    setAvatarBusy(true);
    setAvatarMessage(null);
    const result = await uploadMyProfileImage(avatarFile);
    setAvatarBusy(false);
    if ((result as any)?.error) {
      setAvatarMessage(String((result as any).error));
      return;
    }
    const imageUrl = String((result as any)?.avatar_url || (result as any)?.profile_image_url || (result as any)?.url || "").trim();
    if (imageUrl && token && typeof setSession === "function") {
      setSession(token, { ...(user || {}), avatar_url: imageUrl, profile_image_url: imageUrl });
    }
    setAvatarFile(null);
    setAvatarMessage("Profile image updated");
  }

  async function removeAvatarImage() {
    setAvatarBusy(true);
    setAvatarMessage(null);
    const result = await removeMyProfileImage();
    setAvatarBusy(false);
    if ((result as any)?.error) {
      setAvatarMessage(String((result as any).error));
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    if (token && typeof setSession === "function") setSession(token, { ...(user || {}), avatar_url: null, profile_image_url: null });
    setAvatarMessage("Profile image removed");
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    if (deletePhrase.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Type DELETE to confirm account deletion.");
      return;
    }
    setDeleteBusy(true);
    const result = await deleteMyAccount();
    setDeleteBusy(false);
    if ((result as any)?.error) {
      setDeleteError(String((result as any).error));
      return;
    }
    await logout?.();
    router.replace("/auth/login");
  }

  async function handleSyncWatch() {
    setWatchSyncBusy(true);
    setWatchSyncMessage(null);
    const result = await syncOyiWatchSession(token, user);
    setWatchSyncBusy(false);
    setWatchStatus(result);

    if (!result.available) {
      setWatchSyncMessage(result.reason === "ios_native_only"
        ? "Watch sync requires the iPhone app. Please open Oyi Home on iPhone."
        : "Watch sync is unavailable in this app build.");
      return;
    }
    if (result.error || result.lastSyncError) {
      setWatchSyncMessage(String(result.error || result.lastSyncError));
      return;
    }
    if (!result.paired) {
      setWatchSyncMessage("No paired Apple Watch was found.");
      return;
    }
    if (!(result.watchAppInstalled || result.installed)) {
      setWatchSyncMessage("Install Oyi Watch on your paired Apple Watch, then sync again.");
      return;
    }
    setWatchSyncMessage(isOyiWatchConnected(result)
      ? "Watch connected and live home status confirmed."
      : `${describeOyiWatchStatus(result)}. Open Oyi Watch to complete sync.`);
  }

  async function handleRefreshWatchStatus() {
    setWatchSyncBusy(true);
    const result = await getOyiWatchSyncStatus();
    setWatchSyncBusy(false);
    setWatchStatus(result);
    setWatchSyncMessage(describeOyiWatchStatus(result));
  }

  async function refreshMembers() {
    if (!active.home_id) return setMembers([]);
    setMembers(await homeAccessService.listHomeUsers(active.home_id));
  }

  async function inviteMember() {
    if (!active.home_id || !inviteEmail.trim()) return;
    setAccessBusy("invite");
    setAccessMessage(null);
    try {
      await homeAccessService.inviteHomeUser(active.home_id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      setAccessMessage("Invitation created.");
      await refreshMembers();
    } catch (error: any) {
      setAccessMessage(error?.response?.data?.error || error?.message || "Invite could not be created.");
    } finally {
      setAccessBusy("");
    }
  }

  async function updateMember(member: HomeAccessMember, patch: { role?: string; status?: string }) {
    setAccessBusy(member.id);
    setAccessMessage(null);
    try {
      await homeAccessService.updateHomeUser(member.id, patch);
      await refreshMembers();
    } catch (error: any) {
      setAccessMessage(error?.response?.data?.error || error?.message || "Member access could not be updated.");
    } finally {
      setAccessBusy("");
    }
  }

  async function removeMember(member: HomeAccessMember) {
    setAccessBusy(member.id);
    setAccessMessage(null);
    try {
      await homeAccessService.removeHomeUser(member.id);
      await refreshMembers();
    } catch (error: any) {
      setAccessMessage(error?.response?.data?.error || error?.message || "Member could not be removed.");
    } finally {
      setAccessBusy("");
    }
  }

  function renderPanel() {
    if (!panel) return null;
    const title = menu.find((item) => item.key === panel)?.label || "Profile Information";
    return (
      <div className="fixed inset-0 z-[120] flex items-end bg-black/50 px-4 pb-[calc(12px+var(--sab))] backdrop-blur-md sm:items-center sm:justify-center">
        <section className="flex max-h-[min(74dvh,620px)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#050a12]/94 shadow-[0_24px_78px_rgba(0,0,0,0.58)]">
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-white/[0.055] bg-[#050a12]/96 px-3.5 py-3 backdrop-blur-2xl">
            <h2 className="text-[17px] font-semibold tracking-[-0.04em] text-white">{title}</h2>
            <button type="button" onClick={() => setPanel(null)} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">Back</button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3 text-sm" style={{ WebkitOverflowScrolling: "touch" }}>
            {panel === "personal" ? (
              <>
                <InfoRow label="Name" value={name} />
                <InfoRow label="Email" value={email || "Not provided"} />
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Phone</span>
                  <input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} placeholder="Not provided" className="mt-1.5 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-3 text-sm text-white outline-none transition focus:border-sky-300/35" />
                </label>
                <InfoRow label="Address" value={address || "Not provided"} />
                <button type="button" onClick={() => { setPanel(null); setEditOpen(true); }} className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black">Edit profile</button>
              </>
            ) : null}
            {panel === "access" ? (
              <>
                <InfoRow label="Current home" value={currentHome} />
                <InfoRow label="Role" value={homeRole} />
                <InfoRow label="Home members" value={`${members.length}`} />
                <InfoRow label="Homes available" value={`${active.available_contexts.length}`} />
                <div className="space-y-2">
                  {members.map((member) => {
                    const memberName = member.users?.full_name || member.users?.username || member.users?.email || "Resident";
                    const memberStatus = String(member.status || "active");
                    return (
                      <div key={member.id} className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0"><div className="truncate text-sm font-medium text-white/84">{memberName}</div><div className="truncate text-xs text-white/40">{member.users?.email || "No email"} · {memberStatus}</div></div>
                          <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/48">{member.role || "resident"}</span>
                        </div>
                        {canManageMembers && String(member.users?.id || "") !== String((user as any)?.id || "") ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <select value={member.role || "resident"} onChange={(event) => void updateMember(member, { role: event.target.value })} disabled={accessBusy === member.id} className="rounded-full border border-white/[0.08] bg-[#07101c] px-2 py-1.5 text-xs text-white/70">
                              <option value="owner">Home Owner</option><option value="admin">Admin</option><option value="resident">Resident</option><option value="guest">Guest</option>
                            </select>
                            <button type="button" onClick={() => void updateMember(member, { status: memberStatus === "disabled" ? "active" : "disabled" })} disabled={accessBusy === member.id} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5 text-xs text-white/62">{memberStatus === "disabled" ? "Activate" : "Suspend"}</button>
                            <button type="button" onClick={() => void removeMember(member)} disabled={accessBusy === member.id} className="rounded-full border border-red-300/15 bg-red-500/[0.06] px-2.5 py-1.5 text-xs text-red-100/72">Remove</button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {canManageMembers ? (
                  <div className="rounded-[18px] border border-sky-300/12 bg-sky-400/[0.045] p-3">
                    <div className="text-xs font-semibold text-sky-100">Invite member</div>
                    <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Resident email" className="mt-2 w-full rounded-[14px] border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-white outline-none" />
                    <div className="mt-2 flex gap-2">
                      <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="min-w-0 flex-1 rounded-full border border-white/[0.08] bg-[#07101c] px-3 py-2 text-xs text-white/72"><option value="owner">Home Owner</option><option value="admin">Admin</option><option value="resident">Resident</option><option value="guest">Guest</option></select>
                      <button type="button" onClick={() => void inviteMember()} disabled={accessBusy === "invite" || !inviteEmail.trim()} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{accessBusy === "invite" ? "Sending..." : "Invite"}</button>
                    </div>
                  </div>
                ) : <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-xs leading-5 text-white/46">Only a Home Owner or Admin can change access.</div>}
                {accessMessage ? <p className="px-1 text-xs leading-5 text-white/56">{accessMessage}</p> : null}
              </>
            ) : null}
            {panel === "security" ? (
              <>
                <InfoRow label="Security state" value={securityState} />
                <InfoRow label="Verification" value={verificationLabel} />
                <InfoRow label="2FA" value={String((user as any)?.mfa_enabled ? "Enabled" : "Not enabled")} />
                <InfoRow label="Trusted device" value="This session" />
                <div className="rounded-[18px] border border-red-300/12 bg-red-500/[0.045] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-200"><LockKeyhole className="h-4 w-4" /> Danger Zone</div>
                  <p className="mt-1 text-xs leading-5 text-white/45">Deletion removes your account access where supported by the backend.</p>
                  <button type="button" onClick={() => { setPanel(null); setDeleteOpen(true); }} className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                    <Trash2 className="h-4 w-4" /> Delete my account
                  </button>
                </div>
              </>
            ) : null}
            {panel === "notifications" ? (
              <>
                <InfoRow label="Push" value={notificationsEnabled ? "Enabled" : "Disabled"} />
                <InfoRow label="Email" value={String((user as any)?.email_notifications_enabled ? "Enabled" : "Not configured")} />
                <InfoRow label="SMS" value={String((user as any)?.sms_notifications_enabled ? "Enabled" : "Not configured")} />
                <InfoRow label="Unread alerts" value={`${notifications.filter((item) => item.status !== "read").length}`} />
              </>
            ) : null}
            {panel === "integrations" ? (
              <>
                {integrations.map((item) => <InfoRow key={item.label} label={item.label} value={item.connected ? "Connected" : "Not Connected"} detail={item.detail || undefined} />)}
                <InfoRow label="Watch state" value={describeOyiWatchStatus(watchStatus)} />
                <InfoRow label="Paired" value={watchStatus?.paired ? "Yes" : "No"} />
                <InfoRow label="Watch app" value={watchStatus?.watchAppInstalled || watchStatus?.installed ? "Installed" : "Not installed"} />
                <InfoRow label="Reachable now" value={watchStatus?.reachable ? "Yes" : "No"} />
                <InfoRow label="Last acknowledged" value={watchStatus?.lastAcknowledgedAt ? new Date(watchStatus.lastAcknowledgedAt).toLocaleString() : "Not yet"} />
                <InfoRow label="Last backend fetch" value={watchStatus?.lastBackendSuccessAt ? new Date(watchStatus.lastBackendSuccessAt).toLocaleString() : "Not yet"} />
                <button type="button" onClick={() => void handleSyncWatch()} disabled={watchSyncBusy} className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black transition disabled:cursor-wait disabled:opacity-60">
                  {watchSyncBusy ? "Syncing Watch..." : "Sync Watch"}
                </button>
                <button type="button" onClick={() => void handleRefreshWatchStatus()} disabled={watchSyncBusy} className="w-full rounded-full border border-white/[0.1] bg-white/[0.045] px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-60">
                  Refresh Watch Status
                </button>
                {watchSyncMessage ? <p className="px-1 text-xs leading-5 text-white/54">{watchSyncMessage}</p> : null}
              </>
            ) : null}
            {panel === "preferences" ? (
              <>
                <InfoRow label="Appearance" value={darkMode ? "Dark" : "Light"} />
                <InfoRow label="Voice" value={voiceEnabled ? "Enabled" : "Disabled"} />
                <InfoRow label="Language" value={(user as any)?.language || "Device default"} />
                <InfoRow label="Units" value={(user as any)?.units || "Metric"} />
                <InfoRow label="Temperature" value={(user as any)?.temperature_unit || "Celsius"} />
                <InfoRow label="Timezone" value={Intl.DateTimeFormat().resolvedOptions().timeZone} />
              </>
            ) : null}
            {panel === "support" ? (
              <>
                <button type="button" onClick={() => router.push("/reports")} className="w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-left text-sm font-medium text-white/82 transition hover:bg-white/[0.05]">Documentation</button>
                <button type="button" onClick={() => router.push("/maintenance")} className="w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-left text-sm font-medium text-white/82 transition hover:bg-white/[0.05]">Contact Support</button>
                <button type="button" onClick={() => router.push("/maintenance")} className="w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-left text-sm font-medium text-white/82 transition hover:bg-white/[0.05]">Report Issue</button>
                <button type="button" onClick={() => router.push("/community")} className="w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3 text-left text-sm font-medium text-white/82 transition hover:bg-white/[0.05]">FAQ</button>
              </>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(0,132,255,0.16),transparent_28%),linear-gradient(180deg,rgba(4,12,22,0.18),rgba(0,0,0,0.92))]" />

        <div className="fixed inset-x-0 z-[80] px-5" style={{ top: "calc(8px + var(--sat))" }}>
          <div className="mx-auto flex max-w-[430px] items-center justify-between">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><HamburgerMenu /></div>
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><MessagesInboxButton /></div>
          </div>
        </div>

        <div className="absolute inset-x-0 overflow-y-auto px-5" style={{ top: "calc(64px + var(--sat))", bottom: "calc(78px + var(--sab))", WebkitOverflowScrolling: "touch" }}>
          <div className="mx-auto max-w-[430px] pb-5">
            <section className="grid grid-cols-[1fr_auto] items-center gap-4">
              <div className="min-w-0">
                <h1 className="text-[30px] font-semibold leading-none tracking-[-0.055em] text-white">Profile</h1>
                <p className="mt-3 max-w-[210px] text-[15px] leading-5 text-white/56">Manage your account, home and preferences.</p>
                <div className="mt-7">
                  <div className="truncate text-[22px] font-semibold tracking-[-0.045em] text-white">{name}</div>
                  <div className="mt-1 truncate text-[14px] text-sky-200/76">{email || "No email on profile"}</div>
                  <div className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${verified ? "bg-emerald-400/12 text-emerald-300" : "bg-amber-300/12 text-amber-200"}`}>
                    <ShieldCheck className="h-3.5 w-3.5" /> {verificationLabel}
                  </div>
                </div>
              </div>

              <div className="relative h-[126px] w-[126px] shrink-0 sm:h-[142px] sm:w-[142px]">
                <div className="absolute inset-0 rounded-full border border-sky-300/58 bg-[radial-gradient(circle_at_center,rgba(0,132,255,0.15),rgba(3,8,16,0.95)_66%)] shadow-[0_0_28px_rgba(0,132,255,0.38)]" />
                {displayedAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayedAvatarUrl} alt={name} className="absolute inset-[5px] h-[calc(100%-10px)] w-[calc(100%-10px)] rounded-full object-cover" />
                ) : (
                  <div className="absolute inset-[5px] grid place-items-center rounded-full bg-black/38 text-[34px] font-semibold tracking-[-0.06em] text-white">{initialsFor(name)}</div>
                )}
                <button type="button" onClick={() => setEditOpen(true)} className="absolute bottom-0 right-4 grid h-9 w-9 place-items-center rounded-full border border-sky-300/40 bg-[#06214b] text-sky-200 shadow-[0_0_16px_rgba(0,132,255,0.34)]" aria-label="Open profile editor">
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </section>

            <section className="mt-6 rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.046),rgba(255,255,255,0.012))] p-3 shadow-[0_14px_48px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
              <h2 className="text-[18px] font-semibold tracking-[-0.04em]">Account Overview</h2>
              <div className="mt-4 grid grid-cols-4 divide-x divide-white/[0.065]">
                {overview.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.label} type="button" onClick={() => item.label === "Current Home" ? setPanel("access") : item.label === "Security" ? setPanel("security") : undefined} className="min-w-0 px-1.5 py-0.5 text-center">
                      <Icon className={`mx-auto h-6 w-6 ${item.tint}`} />
                      <div className="mt-2.5 truncate text-[13px] font-semibold leading-4 text-white">{item.value}</div>
                      <div className="mt-0.5 text-[11px] text-white/48">{item.label}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-3 shadow-[0_14px_48px_rgba(0,0,0,0.29)] backdrop-blur-2xl">
              {menu.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button key={item.key} type="button" onClick={() => setPanel(item.key)} className={`flex w-full items-center gap-3 py-3 text-left ${index ? "border-t border-white/[0.055]" : ""}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.035] ${item.color}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold tracking-[-0.03em] text-white">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-white/50">{item.body}</span>
                    </span>
                    <ChevronRight className="h-[18px] w-[18px] text-white/38" />
                  </button>
                );
              })}
              <button type="button" onClick={() => setLogoutOpen(true)} className="flex w-full items-center gap-3 border-t border-white/[0.055] py-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/[0.08] text-red-300"><LogOut className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold tracking-[-0.03em] text-white">Log Out</span><span className="mt-0.5 block text-[13px] text-white/50">Sign out of your account</span></span>
                <ChevronRight className="h-[18px] w-[18px] text-white/38" />
              </button>
            </section>

            <button type="button" onClick={() => setPanel("preferences")} className="mt-4 flex w-full items-center gap-3 rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,rgba(255,255,255,0.042),rgba(255,255,255,0.012))] p-3 text-left shadow-[0_14px_48px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-sky-300/36 bg-[radial-gradient(circle_at_center,rgba(0,132,255,0.24),rgba(2,7,14,0.95)_66%)] text-[20px] font-semibold tracking-[-0.08em] shadow-[0_0_18px_rgba(0,132,255,0.30)]">Oyi</span>
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-white">Oyi Home</span><span className="mt-0.5 block text-[13px] text-white/58">Version {pkg.version}</span><span className="mt-0.5 block text-[13px] text-sky-200/72">Environment: {appEnvironment()}</span>{walletBalance !== null ? <span className="mt-0.5 block text-[11px] text-white/38">Wallet balance: ₦{walletBalance.toLocaleString()}</span> : null}</span>
              <ChevronRight className="h-[18px] w-[18px] text-white/38" />
            </button>
          </div>
        </div>

        {renderPanel()}
        {logoutOpen ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-5 backdrop-blur-md">
            <section className="w-full max-w-[340px] rounded-[28px] border border-white/[0.08] bg-[#050a12]/95 p-5 text-center shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-500/[0.08] text-red-300"><LogOut className="h-6 w-6" /></div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em]">Log out?</h2>
              <p className="mt-2 text-sm text-white/50">You will need to sign in again to control this home.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setLogoutOpen(false)} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white/70">Cancel</button>
                <button type="button" onClick={logout} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-black">Log Out</button>
              </div>
            </section>
          </div>
        ) : null}

        {editOpen ? (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-5 backdrop-blur-md">
            <section className="w-full max-w-[360px] rounded-[26px] border border-white/[0.08] bg-[#050a12]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-[-0.04em]">Profile Information</h2>
                  <p className="mt-1 text-xs text-white/45">Update the editable fields tied to your account.</p>
                </div>
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-white/60">Close</button>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleAvatarPicked(event.target.files?.[0] || null)} />
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-sky-300/30 bg-black/35">
                      {displayedAvatarUrl ? (
                        <img src={displayedAvatarUrl} alt={name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-lg font-semibold text-white">{initialsFor(name)}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">Profile picture</div>
                      <div className="mt-0.5 text-xs text-white/42">Preview before saving. Storage keys stay hidden.</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="rounded-full border border-sky-300/18 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100">Choose image</button>
                    <button type="button" onClick={saveAvatarImage} disabled={!avatarFile || avatarBusy} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{avatarBusy ? "Saving..." : "Save image"}</button>
                    <button type="button" onClick={removeAvatarImage} disabled={avatarBusy || !displayedAvatarUrl} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs text-white/66 disabled:opacity-45">Remove</button>
                  </div>
                  {avatarMessage ? <div className="mt-2 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs text-white/58">{avatarMessage}</div> : null}
                </div>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Full name</span>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-3 text-sm text-white outline-none transition focus:border-sky-300/35" />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-white/35">Username</span>
                  <input value={editUsername} onChange={(event) => setEditUsername(event.target.value)} className="mt-1.5 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-3 text-sm text-white outline-none transition focus:border-sky-300/35" />
                </label>
                <InfoRow label="Email" value={email || "Not provided"} />
                <InfoRow label="Phone" value={phone || "Not provided"} />
                {editError ? <div className="rounded-[14px] border border-red-300/15 bg-red-500/10 px-3 py-2 text-xs text-red-100">{editError}</div> : null}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/70">Cancel</button>
                <button type="button" onClick={saveProfile} disabled={editBusy || !editName.trim()} className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-45">{editBusy ? "Saving..." : "Save"}</button>
              </div>
            </section>
          </div>
        ) : null}

        {deleteOpen ? (
          <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/60 px-5 backdrop-blur-md">
            <section className="w-full max-w-[360px] rounded-[26px] border border-red-300/14 bg-[#08080c]/96 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.66)]">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-500/[0.10] text-red-200"><Trash2 className="h-5 w-5" /></div>
              <h2 className="mt-4 text-center text-lg font-semibold tracking-[-0.04em]">Delete account?</h2>
              <p className="mt-2 text-center text-sm leading-5 text-white/50">This requests permanent account deletion through the backend account endpoint. Type DELETE to continue.</p>
              <input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="Type DELETE" className="mt-5 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3.5 py-3 text-center text-sm tracking-[0.08em] text-white outline-none transition focus:border-red-300/35" />
              {deleteError ? <div className="mt-3 rounded-[14px] border border-red-300/15 bg-red-500/10 px-3 py-2 text-center text-xs text-red-100">{deleteError}</div> : null}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setDeleteOpen(false); setDeletePhrase(""); setDeleteError(null); }} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/70">Cancel</button>
                <button type="button" onClick={handleDeleteAccount} disabled={deleteBusy} className="rounded-full bg-red-200 px-4 py-2.5 text-sm font-semibold text-red-950 disabled:opacity-45">{deleteBusy ? "Deleting..." : "Delete"}</button>
              </div>
            </section>
          </div>
        ) : null}

        <BottomNav />
      </main>
    </LayoutWrapper>
  );
}

function InfoRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">{label}</div>
      <div className="mt-1 text-sm font-medium text-white/82">{value}</div>
      {detail ? <div className="mt-1 text-xs text-white/42">{detail}</div> : null}
    </div>
  );
}
