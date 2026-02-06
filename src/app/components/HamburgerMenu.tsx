// src/app/components/HamburgerMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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

function isActivePath(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function HamburgerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [estateName, setEstateName] = useState<string | null>(null);
  const [homeLabel, setHomeLabel] = useState<string | null>(null);

  // swipe-to-close (drawer drag)
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);

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

  // ✅ lock scroll + add sidebar-open class (hides chat footer/suggestions)
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
      return;
    }

    document.body.style.overflow = "hidden";
    document.body.classList.add("sidebar-open");

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("sidebar-open");
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
      } catch {
        // silent
      }
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
                backgroundColor: "rgba(0,0,0,0.62)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
              aria-label="Close menu overlay"
            />

            {/* drawer */}
            <aside
              className={`fixed inset-y-0 left-0 w-[300px] max-w-[86vw]
                border-r border-white/10
                bg-zinc-950/95
                transform transition-transform duration-200 ease-out
                ${open ? "translate-x-0" : "-translate-x-full"}
              `}
              style={{
                zIndex: DRAWER_Z,
                paddingTop: "var(--sat)",
                paddingLeft: "var(--sal)",
              }}
              onTouchStart={(e) => {
                dragStartX.current = e.touches[0]?.clientX ?? null;
                dragDelta.current = 0;
              }}
              onTouchMove={(e) => {
                if (dragStartX.current === null) return;
                const x = e.touches[0]?.clientX ?? 0;
                dragDelta.current = x - dragStartX.current; // right = positive
              }}
              onTouchEnd={() => {
                // swipe left to close
                if (dragDelta.current < -55) closeAll();
                dragStartX.current = null;
                dragDelta.current = 0;
              }}
            >
              {/* main frame */}
              <div
                className="flex flex-col"
                style={{
                  height: "calc(100dvh - var(--sat))",
                  paddingBottom: "calc(var(--sab) + var(--kb))",
                }}
              >
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl overflow-hidden border border-white/10 bg-black/30">
                        <Image
                          src="/oyi-logo-transparent.png"
                          alt="Oyi"
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                          priority
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-white truncate">
                          Oyi OS
                        </div>
                        <div className="text-[11px] text-white/45 truncate">
                          Resident App
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={closeAll}
                      className="rounded-xl p-2 hover:bg-white/10 text-white/70"
                      aria-label="Close menu"
                      type="button"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Context */}
                  {shouldShowContext ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-[11px] text-white/45">Estate</div>
                      <div className="text-[13px] text-white truncate font-medium">
                        {estateName}
                      </div>
                      {homeLabel ? (
                        <div className="text-[11px] text-white/45 mt-1 truncate">
                          Home: <span className="text-white/70">{homeLabel}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Menu (scrollable) */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                  <div className="px-2 pb-2 text-[11px] text-white/35">
                    Navigation
                  </div>

                  <div className="space-y-1">
                    {MENU_ITEMS.map((item) => {
                      const href = ROUTES[item.key];
                      const active = isActivePath(pathname || "/", href);

                      return (
                        <button
                          key={item.key}
                          onClick={() => onMenuClick(item.key)}
                          className={`w-full text-left rounded-2xl px-4 py-3 text-[14px] transition border
                            ${
                              active
                                ? "bg-white text-black border-white/10"
                                : "bg-transparent text-white/70 border-transparent hover:bg-white/5 hover:border-white/10"
                            }
                          `}
                          type="button"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{item.label}</span>
                            {active ? (
                              <span className="text-[11px] opacity-70">Active</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {/* Account footer (pinned) */}
                <div className="border-t border-white/10 bg-black/20 px-4 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => goToAccount("profile")}
                      className="flex items-center gap-3 min-w-0"
                      type="button"
                    >
                      {/* quieter avatar (no loud red) */}
                      <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-semibold">
                        {initials}
                      </div>

                      <div className="text-left min-w-0">
                        <p className="text-white text-[13px] font-semibold truncate">
                          {displayName}
                        </p>
                        <p className="text-white/45 text-[11px] truncate">
                          {email || "Account"}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="text-white/60 rounded-xl p-2 hover:bg-white/10"
                      aria-label="Toggle account menu"
                      type="button"
                    >
                      {profileOpen ? <FiChevronUp /> : <FiChevronDown />}
                    </button>
                  </div>

                  {profileOpen && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
                      <button
                        onClick={() => goToAccount("profile")}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-white"
                        type="button"
                      >
                        <MdOutlinePerson /> <span className="text-[13px]">Profile</span>
                      </button>

                      <button
                        onClick={() => goToAccount("settings")}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-white"
                        type="button"
                      >
                        <MdSettings /> <span className="text-[13px]">Settings</span>
                      </button>

                      <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/5 transition"
                        type="button"
                      >
                        <FiLogOut /> <span className="text-[13px]">Logout</span>
                      </button>
                    </div>
                  )}

                  <div className="h-3" />
                </div>
              </div>

              {/* Logout confirm */}
              {showLogoutConfirm && (
                <div
                  className="fixed inset-0 flex items-center justify-center px-6"
                  style={{
                    zIndex: DRAWER_Z,
                    backgroundColor: "rgba(0,0,0,0.70)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    paddingTop: "var(--sat)",
                    paddingBottom: "calc(var(--sab) + var(--kb))",
                  }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  <div
                    className="bg-zinc-950 p-6 rounded-3xl w-full max-w-sm border border-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-white text-center font-semibold text-lg mb-2">
                      Logout?
                    </p>
                    <p className="text-white/55 text-center text-sm mb-6">
                      You’ll need to sign in again to access your estate.
                    </p>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 py-3 rounded-2xl bg-white/10 text-white"
                        type="button"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleLogout}
                        className="flex-1 py-3 rounded-2xl bg-white text-black font-semibold"
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
        className="p-2 rounded-xl hover:bg-white/10 text-white/80"
        type="button"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {portalUI}
    </>
  );
}
