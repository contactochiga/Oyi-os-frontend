// src/app/components/HamburgerMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { createPortal } from "react-dom";

import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
// ✅ NEW: token decode fallback (so iOS always has email)
import { decodeToken } from "@/lib/auth";

// ✅ NEW: menu icons
import { FiBarChart2, FiBriefcase, FiCpu, FiCreditCard, FiGrid, FiKey, FiMessageSquare, FiMoon, FiShield, FiTool, FiDroplet, FiWatch } from "react-icons/fi";
import { CONSUMER_MODULES, visibleModules, type ModuleDefinition } from "@/lib/moduleRegistry";

const MODULE_ICONS: Record<string, any> = {
  devices: FiCpu,
  scenes: FiMoon,
  messages: FiMessageSquare,
  security: FiShield,
  utilities: FiDroplet,
  maintenance: FiTool,
  visitors: FiKey,
  wallet: FiCreditCard,
  services: FiBriefcase,
  watch: FiWatch,
  intelligence: FiCpu,
  reports: FiBarChart2,
};

type MenuItem = ModuleDefinition & { icon: any };

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
  const { user, token } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Badge values remain empty until each module has a real unread-count source.
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

  const avatarUrl = useMemo(
    () => String((user as any)?.profile_image_url || (user as any)?.avatar_url || "").trim(),
    [user],
  );

  const closeAll = () => {
    setOpen(false);
  };

  const pushAndClose = (href: string) => {
    closeAll();
    router.push(href);
  };

  const onMenuClick = (href: string) => pushAndClose(href);

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

  // Never invent resident updates. Real unread-count endpoints can hydrate this later.
  useEffect(() => {
    setBadges({
      devices: 0,
      wallet: 0,
      community: 0,
      visitors: 0,
      maintenance: 0,
    });
  }, [token]);

  const menuItems = useMemo<MenuItem[]>(
    () =>
      visibleModules(user as any, CONSUMER_MODULES).map((item) => ({
        ...item,
        icon: MODULE_ICONS[item.key] || FiGrid,
      })).filter((item) => ["devices", "scenes", "visitors", "messages", "maintenance", "wallet", "services", "security", "utilities", "watch", "intelligence", "reports"].includes(item.key)),
    [user],
  );

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
                <div className="border-b border-white/[0.08] px-4 pb-3 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-sky-300/25 bg-white/[0.06] shadow-[0_0_28px_rgba(14,165,233,0.16)]">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-sm font-semibold text-white">{initials}</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-white">{displayName}</div>
                        <div className="truncate text-[11px] text-sky-100/55">Resident Access</div>
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

                </div>

                {/* Menu */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                  <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/34">
                    Your Home
                  </div>

                  <div className="space-y-1">
                    {menuItems.map((item) => {
                      const href = item.href;
                      const active = isActivePath(pathname || "/", href);
                      const Icon = item.icon;
                      const badgeValue = item.badgeKey ? clampBadge((badges as any)[item.badgeKey]) : 0;

                      return (
                        <div key={item.key}>
                          <button
                            onClick={() => onMenuClick(href)}
                            className={`w-full text-left rounded-lg px-3 py-2.5 text-[13px] transition border
                              ${
                                active
                                  ? "border-sky-400/30 bg-sky-400/[0.11] text-white shadow-[0_10px_28px_rgba(14,165,233,0.14)]"
                                  : "bg-transparent text-white/70 border-transparent hover:bg-white/5 hover:border-white/10 hover:text-white"
                              }
                            `}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0
                                    ${
                                      active
                                        ? "bg-white/15 border-white/15 text-white"
                                        : "bg-white/5 border-white/10 text-white/70"
                                    }
                                  `}
                                >
                                  <Icon className="text-[15.5px]" />
                                </span>
                                <span className="font-medium truncate text-[13px]">{item.label}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <BadgePill value={badgeValue} />
                                {active ? <span className="text-[11px] text-white/50">Active</span> : null}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </nav>

              </div>
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
