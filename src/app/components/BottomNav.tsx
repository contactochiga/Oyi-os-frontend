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
  { key: "activity", label: "Activity", href: "/notifications", icon: FiActivity },
  { key: "community", label: "Community", href: "/community", icon: FiUsers },
  { key: "profile", label: "Profile", href: "/account", icon: FiUser },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  if (href === "/notifications") {
    return ["/notifications", "/visitors", "/maintenance", "/messages"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  }
  if (href === "/rooms") {
    return ["/rooms", "/room", "/devices", "/security", "/utilities"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  }
  if (href === "/account") {
    return ["/account", "/wallet", "/services", "/settings", "/ai", "/reports"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[95] border-t border-white/10 bg-[#03070c]/90 backdrop-blur-2xl"
      style={{ paddingBottom: "var(--sab)" }}
      aria-label="Oyi Home navigation"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 px-2 py-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className={`group rounded-2xl px-2 py-2.5 text-center transition active:scale-[0.98] ${
                active
                  ? "bg-[radial-gradient(circle_at_top,rgba(74,168,255,0.28),rgba(255,255,255,0.08))] text-white shadow-[0_0_24px_rgba(74,168,255,0.12)]"
                  : "text-white/52 hover:bg-white/[0.06] hover:text-white/80"
              }`}
            >
              <div className="flex justify-center">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full transition ${
                    active ? "bg-sky-300/15 text-sky-100" : "text-white/58 group-hover:text-white/80"
                  }`}
                >
                  <Icon className="text-[16px]" />
                </span>
              </div>
              <div className="mt-1 text-[10px] font-medium tracking-tight">{item.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
