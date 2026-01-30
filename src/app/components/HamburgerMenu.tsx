// src/app/components/HamburgerMenu.tsx
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

function getApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://oyi-os.onrender.com"
  );
}

async function authedGetJson(url: string) {
  const token =
    (typeof window !== "undefined" && localStorage.getItem("token")) || "";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function tryGetFirst<T = any>(paths: string[]): Promise<T | null> {
  for (const p of paths) {
    try {
      const data = await authedGetJson(p);
      return data as T;
    } catch {
      // try next
    }
  }
  return null;
}

function buildHomeLabel(home: any): string | null {
  if (!home) return null;

  const block = String(home.block || "").trim();
  const unit = String(home.unit || "").trim();
  const name = String(home.name || "").trim();
  const desc = String(home.description || "").trim();

  // prefer "Block A / Unit 4"
  if (block && unit) return `${block} / ${unit}`;
  if (unit && !block) return unit;
  if (block && !unit) return block;

  // fallback to home name
  if (name) return name;

  // LAST fallback (optional): a short descriptor
  if (desc) return desc;

  return null;
}

export default function HamburgerMenu() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // estate/home display state
  const [estateName, setEstateName] = useState<string | null>(null);
  const [homeLabel, setHomeLabel] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const email = (user as any)?.email as string | undefined;

  const initials = useMemo(() => {
    const n =
      (email || "O")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || "O";
    return n[0] || "O";
  }, [email]);

  const displayName = useMemo(() => {
    // avoid type errors: SessionUser doesn't have username
    const u: any = user;
    return (u?.full_name || u?.name || u?.email || "Resident") as string;
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

  // ✅ Fetch estate + home details (touch real endpoints)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const api = getApiBase();

      const estateId = (user as any)?.estate_id as string | undefined;
      const homeId = (user as any)?.home_id as string | undefined;

      // reset
      setEstateName(null);
      setHomeLabel(null);

      // If no estate linked:
      // Option B => show nothing unless we can build a home address label
      if (!estateId) {
        if (!homeId) return;

        // try fetch home to build label
        const home = await tryGetFirst<any>([
          `${api}/homes/${homeId}`,
          `${api}/residents/homes/${homeId}`,
          `${api}/facility/homes/${homeId}`,
        ]);

        if (cancelled) return;
        setHomeLabel(buildHomeLabel(home));
        return;
      }

      // If estate linked, show both estate and home (if exists)
      const estate = await tryGetFirst<any>([
        `${api}/estates/${estateId}`,
        `${api}/estates/${estateId}/public`,
        `${api}/facility/estates/${estateId}`,
      ]);

      if (cancelled) return;
      setEstateName(
        String(
          estate?.name ||
            estate?.estate?.name ||
            estate?.data?.name ||
            "Estate"
        )
      );

      if (!homeId) return;

      const home = await tryGetFirst<any>([
        `${api}/homes/${homeId}`,
        `${api}/residents/homes/${homeId}`,
        `${api}/facility/homes/${homeId}`,
      ]);

      if (cancelled) return;
      setHomeLabel(buildHomeLabel(home));
    }

    run().catch(() => {
      // keep UI clean even if fetch fails
    });

    return () => {
      cancelled = true;
    };
  }, [(user as any)?.estate_id, (user as any)?.home_id]);

  const shouldShowContext = useMemo(() => {
    const estateId = (user as any)?.estate_id as string | undefined;
    if (estateId) return true; // show estate/home section
    // Option B: show ONLY home if we have a homeLabel
    return !!homeLabel;
  }, [user, homeLabel]);

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

                {/* ✅ Estate/Home context (Option B behavior) */}
                {shouldShowContext && (
                  <div className="px-4 pt-4 pb-3 border-b border-white/10">
                    {(user as any)?.estate_id ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-zinc-200">
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                            Estate
                          </span>
                        </div>

                        <div className="text-[13px] text-zinc-200 truncate">
                          Estate:{" "}
                          <span className="text-zinc-100 font-medium">
                            {estateName || "Loading..."}
                          </span>
                        </div>

                        {homeLabel ? (
                          <div className="text-[12px] text-zinc-400 truncate">
                            Home:{" "}
                            <span className="text-zinc-300">{homeLabel}</span>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      // Option B: no estate -> show only home label (if we have it)
                      homeLabel ? (
                        <div className="text-[12px] text-zinc-400 truncate">
                          Home: <span className="text-zinc-300">{homeLabel}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                )}

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
                        className="flex items-center gap-3 min-w-0"
                      >
                        <div className="w-12 h-12 rounded-full bg-[#E11D2E] flex items-center justify-center text-white font-semibold">
                          {initials}
                        </div>

                        <div className="text-left min-w-0">
                          <p className="text-white text-sm font-semibold truncate">
                            {displayName}
                          </p>
                          <p className="text-white/50 text-xs truncate">
                            {email || "Account"}
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
