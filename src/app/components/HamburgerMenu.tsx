// src/app/components/HamburgerMenu.tsx

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
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

const MENU_ITEMS = [
  { key: "rooms", label: "Rooms" },
  { key: "devices", label: "Devices" },
  { key: "wallet", label: "Wallet" },
  { key: "community", label: "Community" },
  { key: "maintenance", label: "Maintenance & Support" },
  { key: "scenes", label: "Scenes" },
  { key: "automations", label: "Automations" },
];

export default function HamburgerMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* Lock background scroll */
  useEffect(() => {
    if (open) document.body.classList.add("sidebar-open");
    else document.body.classList.remove("sidebar-open");
  }, [open]);

  const closeAll = () => {
    setOpen(false);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  };

  const handleLogout = async () => {
    closeAll();
    await logout?.();
    localStorage.clear();
    router.replace("/auth/login");
  };

  const goToAccount = (tab?: "profile" | "settings") => {
    closeAll();
    router.push(tab ? `/account?tab=${tab}` : "/account");
  };

  const initials = user?.username ? user.username[0].toUpperCase() : "U";

  return (
    <>
      {/* TOP BAR ICONS: Hamburger + Logo */}
      <div className="flex items-center gap-2">
        {/* HAMBURGER BUTTON */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="p-2 rounded-md bg-black/60 text-white backdrop-blur
                     hover:bg-black/80 transition"
        >
          {open ? <FiX size={22} /> : <FiMenu size={22} />}
        </button>

        {/* LOGO (same visual size as hamburger) */}
        <button
          onClick={() => {
            // optional: go home / dashboard
            router.push("/");
          }}
          aria-label="Go to Home"
          className="p-2 rounded-md bg-black/60 backdrop-blur
                     hover:bg-black/80 transition"
        >
          <Image
            src="/oyi-logo-transparent.png"
            alt="Oyi"
            width={22}
            height={22}
            className="h-[22px] w-[22px]"
            priority
          />
        </button>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-md"
          onClick={closeAll}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`fixed top-0 left-0 z-[100] h-[100dvh]
          w-[78%] max-w-[360px]
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(8,10,18,0.98), rgba(5,6,12,0.98))",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="h-16" />

        {/* MENU */}
        <nav className="px-5 mt-6 space-y-2">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={closeAll}
              className="w-full text-left py-3 px-4 rounded-xl
                         text-lg text-white
                         hover:bg-white/5 transition"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* PROFILE FOOTER */}
        <div
          className="absolute bottom-0 left-0 w-full
                        px-5 py-5 border-t border-white/10 bg-black/40"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => goToAccount("profile")}
              className="flex items-center gap-3"
            >
              <div
                className="w-12 h-12 rounded-full bg-[#E11D2E]
                              flex items-center justify-center
                              text-white font-semibold"
              >
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
              onClick={() => setProfileOpen((v) => !v)}
              className="text-white/70"
            >
              {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>

          {profileOpen && (
            <div
              className="mt-3 bg-gray-900
                            border border-white/10
                            rounded-xl overflow-hidden"
            >
              <button
                onClick={() => goToAccount("profile")}
                className="w-full flex items-center gap-3
                           px-4 py-3 hover:bg-gray-800 transition"
              >
                <MdOutlinePerson /> Profile
              </button>

              <button
                onClick={() => goToAccount("settings")}
                className="w-full flex items-center gap-3
                           px-4 py-3 hover:bg-gray-800 transition"
              >
                <MdSettings /> Settings
              </button>

              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-3
                           px-4 py-3 text-[#E11D2E]
                           hover:bg-gray-800 transition"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[120]
                        bg-black/70 backdrop-blur
                        flex items-center justify-center px-6"
        >
          <div
            className="bg-gray-900 p-6 rounded-2xl
                          w-full max-w-sm
                          border border-gray-700"
          >
            <p
              className="text-white text-center
                          font-semibold text-lg mb-6"
            >
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
    </>
  );
}
