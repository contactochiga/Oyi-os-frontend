"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import useAuth from "@/hooks/useAuth";
import { createPortal } from "react-dom";

import { XMarkIcon, Bars3Icon } from "@heroicons/react/24/outline";
import { FiChevronDown, FiChevronUp, FiLogOut } from "react-icons/fi";
import { MdOutlinePerson, MdSettings } from "react-icons/md";

// ✅ consumer API helpers (create these tiny wrappers or swap to your existing API)
import API from "@/services/api"; // must exist already in your app
import { listMyInvites } from "@/services/invitesService"; // you pasted this already

const MENU_ITEMS = [
  { key: "rooms", label: "Rooms" },
  { key: "devices", label: "Devices" },
  { key: "wallet", label: "Wallet" },
  { key: "community", label: "Community" },
  { key: "maintenance", label: "Maintenance & Support" },
  { key: "scenes", label: "Scenes" },
  { key: "automations", label: "Automations" },
] as const;

type MenuKey = (typeof MENU_ITEMS)[number]["key"];

const ROUTES: Record<MenuKey, string> = {
  rooms: "/rooms",
  devices: "/devices",
  wallet: "/wallet",
  community: "/community",
  maintenance: "/maintenance",
  scenes: "/scenes",
  automations: "/automations",
};

type LiteContext = {
  estate?: { id: string; name: string } | null;
  home?: { id: string; name: string; unit?: string | null; block?: string | null } | null;
};

export default function HamburgerMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // ✅ avoid TS errors if SessionUser type is smaller than real payload
  const u = (user as any) || {};

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ✅ live badges
  const [ctx, setCtx] = useState<LiteContext>({ estate: null, home: null });
  const [pendingInvites, setPendingInvites] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => setMounted(true), []);

  const displayName = useMemo(() => {
    return String(u.username || u.full_name || u.email || "Resident").trim() || "Resident";
  }, [u.username, u.full_name, u.email]);

  const initials = useMemo(() => {
    const first = displayName?.[0]?.toUpperCase() || "O";
    return first;
  }, [displayName]);

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

  const onMenuClick = (key: MenuKey) => {
    pushAndClose(ROUTES[key]);
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

  /**
   * ✅ Live sync:
   * - pending invites (GET /invites/mine)
   * - estate/home display names (best effort)
   *
   * If you don't have the /me/context endpoint yet, this tries:
   * - /facility/overview first (if your consumer token can access it)
   * - fallback: just show IDs from session token
   */
  async function refreshBadges() {
    try {
      setSyncing(true);

      // 1) Invites badge
      const inv = await listMyInvites();
      const invites = (inv as any)?.invites || [];
      const pending = invites.filter((i: any) => (i.status || "").toLowerCase() === "pending");
      setPendingInvites(pending.length);

      // 2) Estate/Home badge (names)
      // Try to use a lightweight endpoint if available:
      // GET /me/context -> { estate, home }
      try {
        const res = await API.get("/me/context");
        if (res?.data) {
          setCtx({
            estate: res.data.estate ?? null,
            home: res.data.home ?? null,
          });
          return;
        }
      } catch {
        // ignore and fallback below
      }

      // Try facility overview (if consumer token is allowed)
      try {
        const res = await API.get("/facility/overview");
        // if your overview contains estate/home names, map here
        // We'll do best-effort extraction:
        const estateName =
          res?.data?.estate?.name ||
          res?.data?.current_estate?.name ||
          res?.data?.estate_name;
        const homeName =
          res?.data?.home?.name ||
          res?.data?.current_home?.name ||
          res?.data?.home_name;

        setCtx({
          estate: u.estate_id ? { id: String(u.estate_id), name: estateName || "Estate" } : null,
          home: u.home_id ? { id: String(u.home_id), name: homeName || "Home" } : null,
        });
        return;
      } catch {
        // ignore and fallback below
      }

      // Final fallback: show nothing (or just IDs if you want)
      setCtx({
        estate: u.estate_id ? { id: String(u.estate_id), name: "Estate" } : null,
        home: u.home_id ? { id: String(u.home_id), name: "Home" } : null,
      });
    } finally {
      setSyncing(false);
    }
  }

  // ✅ refresh once on mount (when user exists)
  useEffect(() => {
    if (!u?.id) return;
    refreshBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.id]);

  // ✅ refresh whenever menu opens (so after accept invite it updates)
  useEffect(() => {
    if (!open) return;
    refreshBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
                backgroundColor: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(22px)",
                WebkitBackdropFilter: "blur(22px)",
              }}
              aria-label="Close menu overlay"
            />

            <aside
              className={`fixed inset-y-0 left-0 w-[280px]
                bg-zinc-950 border-r border-white/10
                transform transition-transform duration-200 ease-out
                ${open ? "translate-x-0" : "-translate-x-full"}
              `}
              style={{ zIndex: DRAWER_Z }}
            >
              <div className="flex h-[100dvh] flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                  <div className="flex items-center justify-between">
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
                        <div className="text-[11px] text-zinc-500 truncate">Control</div>
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

                  {/* ✅ Badges row */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ctx.estate?.id && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {ctx.estate?.name || "Estate"}
                      </span>
                    )}

                    {ctx.home?.id && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                        {ctx.home?.name || "Home"}
                      </span>
                    )}

                    {pendingInvites > 0 && (
                      <button
                        onClick={() => pushAndClose("/invites")}
                        className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[11px] text-yellow-200"
                        aria-label="View pending invites"
                      >
                        Invites
                        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px]">
                          {pendingInvites}
                        </span>
                      </button>
                    )}

                    {syncing && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-zinc-400">
                        Syncing…
                      </span>
                    )}
                  </div>
                </div>

                {/* Menu */}
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

                {/* Account footer */}
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
                          <p className="text-white text-sm font-semibold">{displayName}</p>
                          <p className="text-white/50 text-xs">{u?.email || "Account"}</p>
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

              {/* Logout confirm */}
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
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="p-2 rounded-lg hover:bg-white/10 text-zinc-200"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>

      {portalUI}
    </>
  );
}
