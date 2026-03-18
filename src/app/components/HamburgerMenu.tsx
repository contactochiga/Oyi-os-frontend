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

// ✅ NEW: token decode fallback (so iOS always has email)
import { decodeToken } from "@/lib/auth";

// ✅ NEW: menu icons
import { FiSliders, FiShield, FiTool, FiSettings } from "react-icons/fi";

type MenuKey =
  | "rooms"
  | "automation"
  | "access_control"
  | "integrations"
  | "maintenance";

const ROUTES: Record<MenuKey, string> = {
  rooms: "/rooms",
  automation: "/devices",
  access_control: "/visitors",
  integrations: "/settings?section=settings",
  maintenance: "/maintenance",
};

const MENU_ITEMS: Array<{
  key: MenuKey;
  label: string;
  icon: any;
  badgeKey?: "maintenance";
}> = [
  { key: "rooms", label: "Home Spaces", icon: FiSliders },
  { key: "automation", label: "Automation", icon: FiSettings },
  { key: "access_control", label: "Visitor Access", icon: FiShield },
  { key: "maintenance", label: "Maintenance & Support", icon: FiTool, badgeKey: "maintenance" },
];

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

function clampBadge(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n > 99) return 99;
  return Math.floor(n);
}

function BadgePill({ value }: { value: number }) {
  if (!value) return null;
  const text = value > 99 ? "99+" : String(value);

  return (
    <span
      className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/80 border border-white/10"
      aria-label={`${text} updates`}
    >
      {text}
    </span>
  );
}

export default function HamburgerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, setSession } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [estateName, setEstateName] = useState<string | null>(null);
  const [homeLabel, setHomeLabel] = useState<string | null>(null);
  const [availableContexts, setAvailableContexts] = useState<any[]>([]);
  const [switchingHomeId, setSwitchingHomeId] = useState<string | null>(null);
  const [showOtherHomes, setShowOtherHomes] = useState(false);

  // ✅ NEW: notification-style badges (UI-only for now, wire later)
  const [badges, setBadges] = useState({
    devices: 0,
    wallet: 0,
    community: 0,
    visitors: 0,
    maintenance: 0,
  });

  // swipe-to-close
  const dragStartX = useRef<number | null>(null);
  const dragDelta = useRef<number>(0);

  useEffect(() => setMounted(true), []);

  // ✅ Email fallback order:
  // 1) session user email
  // 2) decoded JWT email (works on iOS even when session user is blank)
  const email = useMemo(() => {
    if (user?.email) return user.email;

    if (token) {
      const decoded: any = decodeToken(token);
      const fromToken = decoded?.email ? String(decoded.email) : null;
      if (fromToken) return fromToken;
    }

    return null;
  }, [user?.email, token]);

  const initials = useMemo(() => {
    const base =
      (email || "O").trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "O";
    return base[0] || "O";
  }, [email]);

  // ✅ Display name should never show “Resident” if we have an email
  const displayName = useMemo(() => {
    const full = (user as any)?.full_name;
    if (full && String(full).trim()) return String(full).trim();
    if (email) return email;
    return "Resident";
  }, [user, email]);

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
  };

  // lock scroll + sidebar-open class
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
  }, [open]);

  // Fetch consumer context (supports multiple backend response shapes)
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

        const root = (data as any)?.data ?? data;

        const estate =
          root?.estate ?? root?.context?.estate ?? root?.user?.estate ?? null;
        const home =
          root?.home ?? root?.context?.home ?? root?.user?.home ?? null;

        const estateNameResolved = estate?.name
          ? String(estate.name)
          : root?.estate_name
          ? String(root.estate_name)
          : null;

        setEstateName(estateNameResolved);
        setHomeLabel(home ? buildHomeLabel(home) : null);
        setAvailableContexts(Array.isArray(root?.available_contexts) ? root.available_contexts : []);
      } catch {
        // silent
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, user?.estate_id, user?.home_id]);

  // ✅ Badge counts: UI-only seeded numbers for now (no breaking changes).
  // When you’re ready we can replace with a real endpoint e.g. GET /me/badges.
  useEffect(() => {
    if (!token) {
      setBadges({
      devices: 0,
      wallet: 0,
      community: 0,
      visitors: 0,
      maintenance: 0,
      });
      return;
    }

    // Safe default counts (feel free to change)
    setBadges({
      devices: 0,
      wallet: 0,
      community: 0,
      visitors: 0,
      maintenance: 0,
    });
  }, [token]);

  const shouldShowContext = useMemo(
    () => !!estateName || !!homeLabel,
    [estateName, homeLabel],
  );

  async function switchContext(homeId: string) {
    if (!token || !homeId || switchingHomeId === homeId) return;
    setSwitchingHomeId(homeId);
    try {
      const api = getApiBase();
      const res = await fetch(`${api}/me/context/select`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ home_id: homeId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to switch home");

      const estate = data?.estate ?? null;
      const home = data?.home ?? null;

      setEstateName(estate?.name ? String(estate.name) : null);
      setHomeLabel(home ? buildHomeLabel(home) : null);
      setAvailableContexts((prev) =>
        prev.map((ctx: any) => ({
          ...ctx,
          is_active: String(ctx.home_id) === String(homeId),
        }))
      );

      const mergedUser = {
        ...(user || {}),
        estate_id: data?.estate_id ?? estate?.id ?? null,
        home_id: data?.home_id ?? home?.id ?? null,
      };
      setSession(token, mergedUser as any);

      if (typeof window !== "undefined") {
        if (data?.estate_id) localStorage.setItem("ochiga_estate", String(data.estate_id));
        if (data?.home_id) localStorage.setItem("ochiga_home", String(data.home_id));
        window.dispatchEvent(new Event("oyi:context-changed"));
      }

      router.refresh();
      closeAll();
      router.push("/home");
    } catch (e) {
      console.error("switch context failed", e);
    } finally {
      setSwitchingHomeId(null);
    }
  }

  const OVERLAY_Z = 2147483646;
  const DRAWER_Z = 2147483647;

  const portalUI =
    mounted && open
      ? createPortal(
          <>
            <div
              onClick={closeAll}
              className="fixed inset-0"
              style={{
                zIndex: OVERLAY_Z,
                backgroundColor: "rgba(0,0,0,0.52)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
              aria-label="Close menu overlay"
            />

            <aside
              className={`fixed inset-y-0 left-0 w-[300px] max-w-[86vw]
                border-r border-white/10
                bg-[#06080e]/96
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
                dragDelta.current = x - dragStartX.current;
              }}
              onTouchEnd={() => {
                if (dragDelta.current < -55) closeAll();
                dragStartX.current = null;
                dragDelta.current = 0;
              }}
            >
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
                      <div className="h-9 w-9 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
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

                  {shouldShowContext ? (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-[11px] text-white/45">Estate</div>

                      <div className="text-[13px] text-white truncate font-medium">
                        {estateName || "—"}
                      </div>

                      {availableContexts.length > 1 ? (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <button
                            type="button"
                            onClick={() => setShowOtherHomes((value) => !value)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-[13px] text-white truncate font-medium">
                                {homeLabel || "Home"}
                              </div>
                              <div className="mt-0.5 text-[10px] text-white/45 truncate">
                                {Math.max(availableContexts.length - 1, 0)} other homes available
                              </div>
                            </div>
                            {showOtherHomes ? <FiChevronUp className="shrink-0 text-white/65" /> : <FiChevronDown className="shrink-0 text-white/65" />}
                          </button>
                          {showOtherHomes ? (
                            <div className="mt-2 space-y-2">
                            {availableContexts
                              .filter((ctx: any) => !ctx?.is_active)
                              .map((ctx: any) => {
                              const label = buildHomeLabel(ctx) || ctx?.home_name || "Home";
                              return (
                                <button
                                  key={`${ctx.estate_id}:${ctx.home_id}`}
                                  type="button"
                                  onClick={() => switchContext(String(ctx.home_id))}
                                  disabled={switchingHomeId === String(ctx.home_id)}
                                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                                >
                                  <div className="text-[12px] font-medium truncate">{label}</div>
                                  <div className="mt-0.5 text-[10px] text-white/45 truncate">
                                    {ctx?.estate_name || "Estate"}
                                  </div>
                                </button>
                              );
                            })}
                            </div>
                          ) : null}
                        </div>
                      ) : homeLabel ? (
                        <div className="mt-1 text-[11px] text-white/45 truncate">
                          Home:{" "}
                          <span className="text-white/70">{homeLabel}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Menu */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                  <div className="px-2 pb-2 text-[11px] text-white/35">
                    Navigation
                  </div>

                  <div className="space-y-1">
                    {MENU_ITEMS.map((item) => {
                      const href = ROUTES[item.key]; // ✅ same routes
                      const active = isActivePath(pathname || "/", href);
                      const Icon = item.icon;

                      const badgeValue =
                        item.badgeKey ? clampBadge((badges as any)[item.badgeKey]) : 0;

                      return (
                        <button
                          key={item.key}
                          onClick={() => onMenuClick(item.key)}
                          className={`w-full text-left rounded-2xl px-4 py-3 text-[14px] transition border
                            ${
                              active
                                ? "bg-white/10 text-white border-white/10"
                                : "bg-transparent text-white/75 border-transparent hover:bg-white/5 hover:border-white/10"
                            }
                          `}
                          type="button"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-9 h-9 rounded-2xl border flex items-center justify-center shrink-0
                                  ${
                                    active
                                      ? "bg-white/10 border-white/10 text-white"
                                      : "bg-white/5 border-white/10 text-white/70"
                                  }
                                `}
                              >
                                <Icon className="text-[18px]" />
                              </span>

                              <span className="font-medium truncate">
                                {item.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <BadgePill value={badgeValue} />
                              {active ? (
                                <span className="text-[11px] text-white/50">
                                  Active
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </nav>

                {/* Account footer (UNCHANGED) */}
                <div className="border-t border-white/10 bg-white/[0.03] px-4 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={() => goToAccount("profile")}
                      className="flex items-center gap-3 min-w-0"
                      type="button"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-semibold">
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
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                      <button
                        onClick={() => goToAccount("profile")}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-white"
                        type="button"
                      >
                        <MdOutlinePerson />{" "}
                        <span className="text-[13px]">Profile</span>
                      </button>

                      <button
                        onClick={() => goToAccount("settings")}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition text-white"
                        type="button"
                      >
                        <MdSettings />{" "}
                        <span className="text-[13px]">Settings</span>
                      </button>

                      <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:bg-white/5 transition"
                        type="button"
                      >
                        <FiLogOut />{" "}
                        <span className="text-[13px]">Logout</span>
                      </button>
                    </div>
                  )}

                  <div className="h-3" />
                </div>
              </div>

              {/* Logout confirm (UNCHANGED) */}
              {showLogoutConfirm && (
                <div
                  className="fixed inset-0 flex items-center justify-center px-6"
                  style={{
                    zIndex: DRAWER_Z,
                    backgroundColor: "rgba(0,0,0,0.56)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    paddingTop: "var(--sat)",
                    paddingBottom: "calc(var(--sab) + var(--kb))",
                  }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  <div
                    className="bg-[#06080e] p-6 rounded-3xl w-full max-w-sm border border-white/10"
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
          document.body,
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
