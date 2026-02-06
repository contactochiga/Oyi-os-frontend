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
  { key: "home", label: "Home" },
  { key: "rooms", label: "Rooms" },
  { key: "devices", label: "Devices" },
  { key: "wallet", label: "Wallet" },
  { key: "visitors", label: "Visitors" },
  { key: "community", label: "Community" },
  { key: "maintenance", label: "Maintenance & Support" },
] as const;

type MenuKey = (typeof MENU_ITEMS)[number]["key"];

const ROUTES: Record<MenuKey, string> = {
  home: "/home",
  rooms: "/rooms",
  devices: "/devices",
  wallet: "/wallet",
  visitors: "/visitors",
  community: "/community",
  maintenance: "/maintenance",
};

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://oyi-os.onrender.com"
  ).replace(/\/$/, "");
}

function buildHomeLabel(home: any): string | null {
  if (!home) return null;
  const block = String(home.block || "").trim();
  const unit = String(home.unit || "").trim();

  if (block && unit) return `${block} / ${unit}`;
  if (block) return block;
  if (unit) return unit;

  const name = String(home.name || "").trim();
  if (name) return name;

  return null;
}

export default function HamburgerMenu() {
  const router = useRouter();
  const { user, token, logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [estateName, setEstateName] = useState<string | null>(null);
  const [homeLabel, setHomeLabel] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const email = user?.email;

  const initials = useMemo(() => {
    const n =
      (email || "O")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || "O";
    return n[0] || "O";
  }, [email]);

  const displayName = useMemo(() => {
    return (user as any)?.full_name || user?.email || "Resident";
  }, [user]);

  const closeAll = () => {
    setOpen(false);
    setProfileOpen(false);
    setShowLogoutConfirm(false);
  };

  const pushAndClose = (href: string) => {
    closeAll();
    router.push(href);
  };

  const goToAccount = (tab?: "profile" | "settings") => {
    if (tab === "profile") return pushAndClose("/settings?tab=profile");
    if (tab === "settings") return pushAndClose("/settings?tab=settings");
    return pushAndClose("/settings");
  };

  const onMenuClick = (key: MenuKey) => pushAndClose(ROUTES[key]);

  const handleLogout = async () => {
    closeAll();
    await logout?.();
    if (typeof window !== "undefined") localStorage.clear();
    router.replace("/auth/login");
  };

  // ✅ lock scroll + add body class (your global CSS already uses this)
  useEffect(() => {
    if (!open) {
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
      return;
    }

    document.body.classList.add("sidebar-open");
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch consumer context
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setEstateName(null);
      setHomeLabel(null);

      if (!token) return;

      try {
        const api = getApiBase();
        const res = await fetch(`${api}/me/context`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!res.ok) return;

        const data = await res.json();
        if (cancelled) return;

        const estate = data?.estate || null;
        const home = data?.home || null;

        setEstateName(estate?.name ? String(estate.name) : null);
        setHomeLabel(home ? buildHomeLabel(home) : null);
      } catch {}
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, user?.estate_id, user?.home_id]);

  const shouldShowContext = useMemo(() => !!estateName, [estateName]);

  const OVERLAY_Z = 2147483646;
  const DRAWER_Z = 2147483647;

  const portalUI =
    mounted && open
      ? createPortal(
          <>
            {/* overlay */}
            <div
              onClick={closeAll}
              className="fixed inset-0"
              style={{
                zIndex: OVERLAY_Z,
                backgroundColor: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
              aria-label="Close menu overlay"
            />

            {/* drawer */}
            <aside
              className={`fixed left-0 top-0 bottom-0 w-[280px] max-w-[86vw]
                bg-zinc-950 border-r border-white/10
                transform transition-transform duration-200 ease-out
                ${open ? "translate-x-0" : "-translate-x-full"}
              `}
              style={{
                zIndex: DRAWER_Z,
                paddingTop: "calc(env(safe-area-inset-top) + 8px)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)",
              }}
            >
              <div className="flex h-[100dvh] flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
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
                      <div className="text-sm font-medium text-zinc-200 truncate">OYI</div>
                      <div className="text-[11px] text-zinc-500 truncate">Resident App</div>
                    </div>
                  </div>

                  <button
                    onClick={closeAll}
                    className="rounded-lg p-2 hover:bg-white/10"
                    aria-label="Close menu"
                    type="button"
                  >
                    <XMarkIcon className="h-5 w-5 text-zinc-300" />
                  </button>
                </div>

                {/* Estate/Home context */}
                {shouldShowContext && (
                  <div className="px-4 pt-4 pb-3 border-b border-white/10">
                    <div className="space-y-1">
                      <div className="text-[13px] text-zinc-200 truncate">
                        Estate: <span className="text-zinc-100 font-medium">{estateName}</span>
                      </div>

                      {homeLabel ? (
                        <div className="text-[12px] text-zinc-400 truncate">
                          Home: <span className="text-zinc-300">{homeLabel}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Menu */}
                <nav className="px-4 py-4 space-y-1 overflow-y-auto">
                  {MENU_ITEMS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onMenuClick(item.key)}
                      className="w-full text-left rounded-xl px-4 py-3 text-sm transition
                                 text-zinc-300 hover:bg-white/5 active:bg-white/10"
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                {/* Account footer */}
                <div className="mt-auto">
                  <div
                    className="px-4 pt-4 border-t border-white/10 bg-black/30"
                    style={{
                      paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => goToAccount("profile")}
                        className="flex items-center gap-3 min-w-0"
                        type="button"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                          {initials}
                        </div>

                        <div className="text-left min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                          <p className="text-white/50 text-xs truncate">{email || "Account"}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setProfileOpen((v) => !v)}
                        className="text-white/70 rounded-lg p-2 hover:bg-white/5"
                        aria-label="Toggle account menu"
                        type="button"
                      >
                        {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
                      </button>
                    </div>

                    {profileOpen && (
                      <div className="mt-3 bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                        <button
                          onClick={() => goToAccount("profile")}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
                          type="button"
                        >
                          <MdOutlinePerson /> Profile
                        </button>

                        <button
                          onClick={() => goToAccount("settings")}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-white"
                          type="button"
                        >
                          <MdSettings /> Settings
                        </button>

                        <button
                          onClick={() => setShowLogoutConfirm(true)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-[#E11D2E] hover:bg-gray-800 transition"
                          type="button"
                        >
                          <FiLogOut /> Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Logout confirm */}
              {showLogoutConfirm && (
                <div
                  className="fixed inset-0 flex items-center justify-center px-6"
                  style={{
                    zIndex: DRAWER_Z,
                    backgroundColor: "rgba(0,0,0,0.75)",
                    backdropFilter: "blur(22px)",
                    WebkitBackdropFilter: "blur(22px)",
                    paddingTop: "env(safe-area-inset-top)",
                    paddingBottom: "env(safe-area-inset-bottom)",
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
                        type="button"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleLogout}
                        className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white"
                        type="button"
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
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="p-2 rounded-lg hover:bg-white/10 text-zinc-200"
        type="button"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {portalUI}
    </>
  );
}
