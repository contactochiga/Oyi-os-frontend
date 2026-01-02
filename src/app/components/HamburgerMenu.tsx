"use client";

import { useState, useEffect } from "react";
import {
  FiMenu,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiLogOut,
} from "react-icons/fi";
import { MdOutlinePerson, MdSettings } from "react-icons/md";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import SlideUpSettings from "./SlideUpSettings";

const MENU_ITEMS = ["Devices", "Scenes", "Automations"];

export default function HamburgerMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  /* Lock scroll */
  useEffect(() => {
    document.body.classList.toggle("sidebar-open", open);
    return () => document.body.classList.remove("sidebar-open");
  }, [open]);

  const closeAll = () => {
    setOpen(false);
    setProfileOpen(false);
  };

  const initials = user?.username
    ? user.username[0].toUpperCase()
    : "U";

  return (
    <>
      {/* MENU BUTTON */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md bg-black/60 text-white backdrop-blur hover:bg-black/80 transition"
      >
        {open ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
          onClick={closeAll}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 z-50 h-[100dvh] w-[78%] max-w-[360px]
        transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(8,10,18,0.98), rgba(5,6,12,0.98))",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="h-16" />

        {/* MENU ITEMS */}
        <nav className="px-5 mt-6 space-y-2">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item}
              style={{ animationDelay: `${i * 60}ms` }}
              className="w-full text-left py-3 px-4 rounded-xl text-lg
              text-white opacity-0 -translate-x-2
              slide-in-item hover:bg-white/5 transition"
            >
              {item}
            </button>
          ))}
        </nav>

        {/* USER AREA */}
        <div className="absolute bottom-0 left-0 w-full px-5 py-5 border-t border-white/10 bg-black/40">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-semibold">
                  {user?.username || "Resident"}
                </p>
                <p className="text-white/50 text-xs">
                  {user?.email || "Account"}
                </p>
              </div>
            </button>

            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="text-white/70"
            >
              {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>

          {profileOpen && (
            <div className="mt-3 bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition">
                <MdOutlinePerson /> Profile
              </button>

              <button
                onClick={() => {
                  setShowSettings(true);
                  closeAll();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition"
              >
                <MdSettings /> Settings
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#E11D2E] hover:bg-gray-800 transition"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* SETTINGS */}
      <SlideUpSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur flex items-center justify-center px-6">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700">
            <p className="text-white text-center font-semibold text-lg mb-6">
              Logout from Oyi OS?
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-700"
              >
                Cancel
              </button>

              <button
                onClick={async () => {
                  await logout();
                  router.replace("/auth/login");
                }}
                className="flex-1 py-3 rounded-xl bg-[#E11D2E]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAFE KEYFRAMES */}
      <style jsx>{`
        .slide-in-item {
          animation: slideIn 0.35s ease-out forwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
