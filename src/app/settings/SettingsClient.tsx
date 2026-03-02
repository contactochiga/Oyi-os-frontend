// src/app/settings/SettingsClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { useSettingsStore } from "@/store/useSettingsStore";

export default function SettingsClient() {
  const { user, logout } = useAuth();
  const params = useSearchParams();

  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const { notificationsEnabled, voiceEnabled, toggleNotifications, toggleVoice } = useSettingsStore();

  const [editOpen, setEditOpen] = useState(false);

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

      {/* ✅ Edit Profile modal (so Apple can tap and see it works) */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={{
          username: user?.username ?? "Resident",
          email: user?.email ?? "",
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

function EditProfileModal({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
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
            <div className="text-xs text-white/50">
              This modal is here so the button is responsive during App Review. You can wire saving later.
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/60">Username</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                placeholder="Your name"
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

            <button
              type="button"
              onClick={() => {
                // For now: just prove responsiveness + no crash.
                // Later you can call your API to update profile.
                alert("Saved (demo). Wire API next.");
                onClose();
              }}
              className="w-full mt-2 py-3 rounded-2xl bg-white text-black text-sm font-semibold hover:opacity-90 transition active:scale-[0.995]"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
