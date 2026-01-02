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

interface HamburgerMenuProps {
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

const MENU_ITEMS = [
  "Devices",
  "Scenes",
  "Automations",
  "Access & Security",
  "Energy",
  "Community",
];

export default function HamburgerMenu({
  isOpen = false,
  onToggle,
}: HamburgerMenuProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [open, setOpen] = useState(isOpen);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [open]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
    setShowSettings(false);
    onToggle?.(false);
  };

  const toggleMenu = () => {
    const next = !open;
    setOpen(next);
    if (!next) setProfileOpen(false);
    onToggle?.(next);
  };

  const handleLogout = () => {
    document.cookie = "ochiga_estate_auth=; Max-Age=0; path=/";
    localStorage.clear();
    router.replace("/auth/login");
  };

  const initials = user?.username
    ? user.username[0].toUpperCase()
    : "U";

  return (
    <>
      {/* TOP BUTTON */}
      <button
        onClick={toggleMenu}
        className="p-2 rounded-md bg-gray-800/70 hover:bg-gray-800 text-white transition"
      >
        {open ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* FULLSCREEN SIDEBAR */}
      <aside
        className={`fixed inset-0 z-[9999] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]
          ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background:
            "linear-gradient(180deg, #05070C 0%, #090B12 100%)",
        }}
      >
        {/* TOP SPACER */}
        <div className="h-16" />

        {/* MENU */}
        <nav className="px-6 mt-8 space-y-2">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item}
              style={{ animationDelay: `${i * 60}ms` }}
              className="w-full text-left py-3 px-4 rounded-xl text-lg text-white
                         opacity-0 translate-x-[-8px] animate-[slideIn_.35s_ease-out_forwards]
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

        {/* USER SECTION */}
        <div className="absolute bottom-0 left-0 w-full px-6 py-5 border-t border-white/10 bg-black/50">
          <div className="flex items-center justify-between">
            <button className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">
                  {user?.username || "Resident"}
                </p>
                <p className="text-white/50 text-xs">
                  {user?.email || "View profile"}
                </p>
              </div>
            </button>

            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="p-2 text-white/70"
            >
              {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>

          {profileOpen && (
            <div className="mt-3 bg-gray-900/95 border border-white/5 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition">
                <MdOutlinePerson size={18} /> Profile
              </button>

              <button
                onClick={() => {
                  setShowSettings(true);
                  closeAll();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition"
              >
                <MdSettings size={18} /> Settings
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-[#E11D2E] hover:bg-gray-800 transition"
              >
                <FiLogOut size={18} /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center px-6">
          <div className="bg-gray-900 px-6 py-6 rounded-2xl w-full max-w-sm border border-gray-700">
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
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl bg-[#E11D2E]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      <SlideUpSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* SLIDE-IN KEYFRAME */}
      <style jsx>{`
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
