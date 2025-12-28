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

  // Sync with parent if needed
  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  // Body lock
  useEffect(() => {
    if (open) document.body.classList.add("sidebar-open");
    else document.body.classList.remove("sidebar-open");
  }, [open]);

  // Escape handler
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
      {/* TOPBAR BUTTON */}
      <button
        onClick={toggleMenu}
        className="p-2 rounded-md bg-gray-800/70 hover:bg-gray-800 text-white transition"
      >
        {open ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
      </button>

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 h-[100dvh] w-[72%] max-w-[360px] z-40 transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, #06080E 0%, #090A0F 100%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="h-16" />

        {/* NAVIGATION */}
        <nav className="px-4 mt-6 space-y-1 text-gray-200">
          {[
            "Home",
            "Voice Assistant",
            "Devices",
            "Scenes",
            "Automations",
          ].map((item) => (
            <button
              key={item}
              className="w-full text-left py-3 px-3 rounded-lg hover:bg-gray-800 transition"
            >
              {item}
            </button>
          ))}
        </nav>

        {/* USER SECTION */}
        <div className="absolute bottom-0 left-0 w-full px-4 py-5 border-t border-white/10 bg-black/40">
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
              {profileOpen ? (
                <FiChevronUp size={20} />
              ) : (
                <FiChevronDown size={20} />
              )}
            </button>
          </div>

          {profileOpen && (
            <div className="mt-3 bg-gray-900/95 border border-white/5 rounded-xl overflow-hidden shadow-xl">
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

      {/* OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
          onClick={closeAll}
        />
      )}

      {/* SETTINGS */}
      <SlideUpSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6">
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
                className="flex-1 py-3 rounded-xl bg-[#E11D2E] hover:bg-[#C81E2A]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
