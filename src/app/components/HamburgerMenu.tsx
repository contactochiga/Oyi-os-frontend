"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { createPortal } from "react-dom";

import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { FiChevronDown, FiChevronUp, FiLogOut } from "react-icons/fi";
import { MdOutlinePerson, MdSettings } from "react-icons/md";

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

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => setMounted(true), []);

  const initials = useMemo(() => {
    const name = user?.username || user?.email || "O";
    return name.trim()?.[0]?.toUpperCase() || "O";
  }, [user?.username, user?.email]);

  const closeAll = () => {
    setOpen(false);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  };

  const goToAccount = (tab?: "profile" | "settings") => {
    closeAll();
    router.push(tab ? `/account?tab=${tab}` : "/account");
  };

  const onMenuClick = (key: string) => {
    // hook navigation later if you want
    closeAll();
  };

  const handleLogout = async () => {
    closeAll();
    await logout?.();
    if (typeof window !== "undefined") localStorage.clear();
    router.replace("/auth/login");
  };

  // ✅ lock scroll + ESC to close
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const OVERLAY_Z = 2147483646; // near max
  const DRAWER_Z = 2147483647; // max-ish

  const portalUI =
    mounted && open
      ? createPortal(
          <>
            {/* ✅ FULL SCREEN BLUR OVERLAY (always above everything) */}
            <div
              onClick={closeAll}
              className="fixed inset-0"
              style={{
                zIndex: OVERLAY_Z,
                backgroundColor: "rgba(0,0,0,0.72)", // heavier cover
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
              aria-label="Close menu overlay"
            />

            {/* ✅ DRAWER */}
            <aside
              className={`fixed inset-y-0 left-0 w-[280px]
                bg-zinc-950 border-r border-white/10
                transform transition-transform duration-200 ease-out
                ${open ? "translate-x-0" : "-translate-x-full"}
              `}
              style={{ zIndex: DRAWER_Z }}
            >
              <div className="flex h-[100dvh] flex-col">
                {/* HEADER */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-md overflow-hidden border border-white/10 bg-black/40">
                      <Image
                        src="/oyi-logo-transparent.png"
                        alt="Oyi"
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                        priority
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-200 truncate">
                        OYI
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">
                        Control
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={closeAll}
                    className="rounded-lg p-2 hover:bg-white/10"
                    aria-label="Close menu"
                  >
                    <XMarkIcon className="h-5 w-5 text-zinc-300" />
                  </button>
                </div>

                {/* MENU */}
                <nav className="px-4 py-4 space-y-1">
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onMenuClick(item.key)}
                      className="w-full text-left rounded-xl px-4 py-3 text-sm transition
                                 text-zinc-300 hover:bg-white/5"
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                {/* ACCOUNT FOOTER */}
                <div className="mt-auto">
                  <div className="px-4 pb-5 border-t border-white/10 bg-black/30">
                    <div className="pt-5 flex items-center justify-between">
                      <button
                        onClick={() => goToAccount("profile")}
                        className="flex items-center gap-3"
                      >
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
                        onClick={() => setProfileOpen((v) => !v)}
                        className="text-white/70"
                        aria-label="Toggle account menu"
                      >
                        {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
                      </button>
                    </div>

                    {profileOpen && (
                      <div className="mt-3 bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                        <button
                          onClick={() => goToAccount("profile")}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
                        >
                          <MdOutlinePerson /> Profile
                        </button>

                        <button
                          onClick={() => goToAccount("settings")}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
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
                </div>
              </div>

              {/* LOGOUT CONFIRM (also inside drawer z-layer) */}
              {showLogoutConfirm && (
                <div
                  className="fixed inset-0 flex items-center justify-center px-6"
                  style={{
                    zIndex: DRAWER_Z,
                    backgroundColor: "rgba(0,0,0,0.75)",
                    backdropFilter: "blur(22px)",
                    WebkitBackdropFilter: "blur(22px)",
                  }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  <div
                    className="bg-gray-900 p-6 rounded-2xl w-full max-w-sm border border-gray-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-white text-center font-semibold text-lg mb-6">
                      Logout from Oyi OS?
                    </p>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 py-3 rounded-xl bg-gray-700 text-white"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleLogout}
                        className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </>,
          document.body
        )
      : null;

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="p-2 rounded-lg hover:bg-white/10 text-zinc-200"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {/* Portal render */}
      {portalUI}
    </>
  );
}
