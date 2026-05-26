"use client";

import { usePathname, useRouter } from "next/navigation";
import { FiActivity, FiHome, FiLayers, FiUser, FiUsers } from "react-icons/fi";

type Item = {
  key: "home" | "spaces" | "activity" | "community" | "profile";
  label: string;
  href: string;
  icon: any;
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", href: "/home", icon: FiHome },
  { key: "spaces", label: "Spaces", href: "/rooms", icon: FiLayers },
  { key: "activity", label: "Activity", href: "/activity", icon: FiActivity },
  { key: "community", label: "Community", href: "/community", icon: FiUsers },
  { key: "profile", label: "Profile", href: "/profile", icon: FiUser },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  if (href === "/activity") {
    return [
      "/activity",
      "/notifications",
      "/visitors",
      "/maintenance",
      "/messages",
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (href === "/rooms") {
    return ["/rooms", "/room", "/devices", "/security", "/utilities"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
  }
  if (href === "/profile") {
    return [
      "/profile",
      "/account",
      "/wallet",
      "/services",
      "/settings",
      "/ai",
      "/reports",
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] px-5"
      style={{ paddingBottom: "calc(10px + var(--sab))" }}
      aria-label="Oyi Home navigation"
    >
      <div className="pointer-events-auto mx-auto grid max-w-[820px] grid-cols-5 gap-1 rounded-[30px] border border-white/[0.085] bg-[#040911]/82 px-3 py-2 shadow-[0_20px_70px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className={`group rounded-[22px] px-1 py-2 text-center transition active:scale-[0.98] ${
                active ? "text-white" : "text-white/46 hover:text-white/78"
              }`}
            >
              <div className="flex justify-center">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-[15px] transition ${
                    active
                      ? "bg-sky-300/16 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.36)]"
                      : "text-white/52 group-hover:bg-white/[0.05] group-hover:text-white/78"
                  }`}
                >
                  <Icon className="text-[20px]" />
                </span>
              </div>
              <div
                className={`mt-1 text-[11px] font-medium tracking-[-0.025em] ${
                  active ? "text-white" : "text-white/48"
                }`}
              >
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
