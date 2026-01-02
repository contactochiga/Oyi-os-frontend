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

const MENU_ITEMS = [
  "Devices",
  "Scenes",
  "Automations",
  "Access & Security",
  "Energy",
  "Community",
];

export default function HamburgerMenu() {
  const router = useRouter();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = user?.username
    ? user.username[0].toUpperCase()
    : "U";

  return (
    <>
      {/* TOGGLE */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md bg-gray-800/70 hover:bg-gray-800 text-white"
      >
        {open ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* FULLSCREEN DRAWER */}
      <aside
        className={`fixed inset-0 z-[9999] transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, #05070C 0%, #090B12 100%)",
        }}
      >
        <div className="h-16" />

        {/* MENU */}
        <nav className="px-6 mt-8 space-y-2">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item}
              data-delay={i}
              className="menu-item w-full text-left py-3 px-4 rounded-xl
                         text-lg text-white opacity-0 translate-x-[-8px]
                         hover:bg-white/5 transition"
            >
              {item}
            </button>
          ))}
        </nav>

        {/* LISTENING INDICATOR */}
        <div className="absolute bottom-28 left-6 right-6">
          <div className="flex items-center gap-3 text-gray-400 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Oyi is listening
          </div>
        </div>

        {/* USER */}
        <div className="absolute bottom-0 left-0 w-full px-6 py-5 border-t border-white/10 bg-black/50">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                {initials}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">
                  {user?.username || "Resident"}
                </p>
                <p className="text-white/50 text-xs">
                  {user?.email || "View profile"}
                </p>
              </div>
            </div>

            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="p-2 text-white/70"
            >
              {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>

          {profileOpen && (
            <div className="mt-3 bg-gray-900 rounded-xl border border-white/5">
              <button className="w-full px-4 py-3 flex gap-3 hover:bg-gray-800">
                <MdOutlinePerson /> Profile
              </button>

              <button
                onClick={() => {
                  setShowSettings(true);
                  setOpen(false);
                }}
                className="w-full px-4 py-3 flex gap-3 hover:bg-gray-800"
              >
                <MdSettings /> Settings
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full px-4 py-3 flex gap-3 text-red-500 hover:bg-gray-800"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* LOGOUT MODAL */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center px-6">
          <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700">
            <p className="text-white text-center font-semibold mb-6">
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
                onClick={() => router.replace("/auth/login")}
                className="flex-1 py-3 rounded-xl bg-[#E11D2E]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <SlideUpSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* ANIMATION */}
      <style jsx>{`
        .menu-item {
          animation: slideIn 0.35s ease-out forwards;
          animation-delay: calc(attr(data-delay number) * 60ms);
        }

        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
