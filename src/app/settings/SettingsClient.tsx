// src/app/settings/SettingsClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { useSettingsStore } from "@/store/useSettingsStore";
import { deleteMyAccount, updateMyProfile } from "@/services/authService";
import API from "@/services/api";
import { roomsService, type RoomDTO } from "@/services/roomsService";

type AccessResident = {
  id: string;
  label: string;
  email?: string;
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
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [assigningAccess, setAssigningAccess] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [customResidentId, setCustomResidentId] = useState("");
  const [assignRole, setAssignRole] = useState("member");
  const [permissions, setPermissions] = useState({
    control_devices: true,
    manage_visitors: false,
    post_community: true,
    view_finance: false,
  });

  const initials = useMemo(() => {
    const u = (user as any)?.username || (user as any)?.name || "User";
    return String(u).trim().charAt(0).toUpperCase() || "U";
  }, [user]);

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
    const homeId =
      (user as any)?.home_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null);

    if (!homeId) return;

    const parseResidentList = (ctx: any): AccessResident[] => {
      const buckets = [
        ctx?.members,
        ctx?.residents,
        ctx?.users,
        ctx?.home?.members,
        ctx?.home?.residents,
        ctx?.home?.users,
        ctx?.estate?.members,
      ];
      const firstList = buckets.find((arr) => Array.isArray(arr)) || [];
      return (firstList as any[])
        .map((m) => {
          const id = String(m?.id ?? m?.user_id ?? m?.resident_id ?? "").trim();
          if (!id) return null;
          const label =
            m?.full_name ||
            m?.name ||
            m?.username ||
            m?.email ||
            `Resident ${id.slice(0, 6)}`;
          return { id, label: String(label), email: m?.email ? String(m.email) : undefined };
        })
        .filter(Boolean) as AccessResident[];
    };

    const run = async () => {
      setAccessLoading(true);
      setAccessError(null);
      try {
        const [roomList, ctxRes] = await Promise.all([
          roomsService.getRooms(String(homeId)),
          API.get("/me/context").catch(() => null),
        ]);

        setRooms(Array.isArray(roomList) ? roomList : []);

        const ctxPayload = (ctxRes as any)?.data?.data ?? (ctxRes as any)?.data ?? null;
        const parsedResidents = parseResidentList(ctxPayload);
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
  }, [user]);

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
    } catch (e: any) {
      setAccessError(e?.response?.data?.error || e?.message || "Failed to assign resident to room");
    } finally {
      setAssigningAccess(false);
    }
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
        <Row label="Estate" value={(user as any)?.estate_name ?? "—"} />
        <Row label="Unit" value={(user as any)?.unit_name ?? "—"} />
        <Row label="Role" value={user?.role ?? "resident"} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm text-gray-400">Room Access Control</h3>

        <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 space-y-3">
          <div className="text-xs text-gray-400">
            Assign residents to specific rooms and set role-based permissions.
          </div>

          {accessLoading ? (
            <div className="text-sm text-gray-400">Loading access manager…</div>
          ) : (
            <>
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

              {accessError ? <div className="text-xs text-red-300">{accessError}</div> : null}
            </>
          )}
        </div>

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
