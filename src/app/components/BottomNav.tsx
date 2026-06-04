"use client";

import { usePathname, useRouter } from "next/navigation";
import { FiActivity, FiHome, FiLayers, FiUser, FiUsers } from "react-icons/fi";
import { useNotificationStore } from "@/store/useNotificationStore";

type Item = {
  key: "home" | "spaces" | "activity" | "community" | "profile";
  label: string;
  href: string;
  icon: any;
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", href: "/home", icon: FiHome },
  { key: "spaces", label: "Spaces", href: "/spaces", icon: FiLayers },
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
  if (href === "/spaces") {
    return ["/spaces", "/rooms", "/room", "/devices", "/security", "/utilities"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
  }
  if (href === "/profile") {
    return [
      "/profile",
      "/wallet",
      "/services",
      "/profile",
      "/ai",
      "/reports",
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const unreadByBucket = useNotificationStore((state) => state.unreadByBucket);
  const markBucketViewed = useNotificationStore((state) => state.markBucketViewed);

  const badgeFor = (key: Item["key"]) => {
    if (key === "community") return unreadByBucket.community || 0;
    if (key === "activity") return unreadByBucket.activity || unreadByBucket.messages || 0;
    if (key === "profile") return unreadByBucket.profile || 0;
    return 0;
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] px-5"
      style={{ paddingBottom: "calc(8px + var(--sab))" }}
      aria-label="Oyi Home navigation"
    >
      <div className="pointer-events-auto mx-auto grid max-w-[430px] grid-cols-5 gap-0.5 rounded-[26px] border border-white/[0.07] bg-[#040911]/84 px-2.5 py-1.5 shadow-[0_16px_54px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge = badgeFor(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                if (item.key === "community") markBucketViewed("community");
                if (item.key === "activity") {
                  markBucketViewed("activity");
                  markBucketViewed("messages");
                }
                if (item.key === "profile") markBucketViewed("profile");
                router.push(item.href);
              }}
              className={`group rounded-[20px] px-1 py-1.5 text-center transition active:scale-[0.98] ${
                active ? "text-white" : "text-white/46 hover:text-white/78"
              }`}
            >
              <div className="flex justify-center">
                <span
                  className={`relative grid h-7 w-7 place-items-center rounded-[13px] transition ${
                    active
                      ? "bg-sky-300/14 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.32)]"
                      : "text-white/52 group-hover:bg-white/[0.05] group-hover:text-white/78"
                  }`}
                >
                  <Icon className="text-[18px]" />
                  {badge ? (
                    <span className={`absolute ${badge > 1 ? "-right-1 -top-1 min-w-[16px] px-1" : "right-0.5 top-0.5 h-2 w-2"} rounded-full bg-sky-300 text-[9px] font-bold leading-4 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.8)]`}>
                      {badge > 1 ? Math.min(badge, 9) : ""}
                    </span>
                  ) : null}
                </span>
              </div>
              <div
                className={`mt-0.5 text-[10px] font-medium tracking-[-0.025em] ${
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
