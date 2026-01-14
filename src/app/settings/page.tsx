"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import LayoutWrapper from "../components/LayoutWrapper";
import useAuth from "@/hooks/useAuth";
import { useSettingsStore } from "@/store/useSettingsStore";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const params = useSearchParams();
  const router = useRouter();

  const profileRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const {
    notificationsEnabled,
    voiceEnabled,
    toggleNotifications,
    toggleVoice,
  } = useSettingsStore();

  /* --------------------------------
     AUTO SCROLL BASED ON ENTRY
  --------------------------------- */
  useEffect(() => {
    const section = params.get("section");
    if (section === "settings") {
      settingsRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      profileRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [params]);

  return (
    <LayoutWrapper>
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">

        {/* PROFILE HEADER */}
        <section ref={profileRef} className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-[#16A34A] mx-auto
                          flex items-center justify-center
                          text-white text-2xl font-semibold">
            {user?.username?.[0]?.toUpperCase() ?? "U"}
          </div>

          <div>
            <div className="text-xl font-semibold">
              {user?.username ?? "Resident"}
            </div>
            <div className="text-sm text-gray-400">
              {user?.email}
            </div>
          </div>

          <button
            className="px-4 py-2 rounded-full border border-gray-700
                       text-sm text-gray-300 hover:bg-gray-800 transition"
          >
            Edit profile
          </button>
        </section>

        {/* ACCOUNT */}
        <section className="space-y-4">
          <h3 className="text-sm text-gray-400">Account</h3>

          <Row label="Email" value={user?.email} />
          <Row label="Estate" value={user?.estate_name ?? "—"} />
          <Row label="Unit" value={user?.unit_name ?? "—"} />
          <Row label="Role" value={user?.role ?? "resident"} />
        </section>

        {/* SETTINGS */}
        <section ref={settingsRef} className="space-y-4">
          <h3 className="text-sm text-gray-400">Preferences</h3>

          <ToggleRow
            label="Notifications"
            value={notificationsEnabled}
            onChange={toggleNotifications}
          />

          <ToggleRow
            label="Voice assistant"
            value={voiceEnabled}
            onChange={toggleVoice}
          />
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
            onClick={logout}
            className="w-full py-3 rounded-xl
                       text-[#E11D2E] font-medium
                       hover:bg-red-600/10 transition"
          >
            Log out
          </button>
        </section>

      </main>
    </LayoutWrapper>
  );
}

/* --------------------------------
   SMALL REUSABLE ROWS
--------------------------------- */

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between
                    bg-gray-900 border border-gray-800
                    rounded-xl px-4 py-3">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm text-gray-400">{value}</span>
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
      onClick={onChange}
      className="w-full flex items-center justify-between
                 bg-gray-900 border border-gray-800
                 rounded-xl px-4 py-3"
    >
      <span className="text-sm text-gray-300">{label}</span>

      <div
        className={`w-11 h-6 rounded-full transition
          ${value ? "bg-[#16A34A]" : "bg-gray-700"}
        `}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full mt-[2px] transition
            ${value ? "ml-[22px]" : "ml-[2px]"}
          `}
        />
      </div>
    </button>
  );
}
