"use client";

import { usePathname, useRouter } from "next/navigation";
import { FiHome, FiCpu, FiCreditCard, FiUsers, FiKey } from "react-icons/fi";

type Item = {
  key: "home" | "devices" | "wallet" | "community" | "visitors";
  label: string;
  href: string;
  icon: any;
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", href: "/home", icon: FiHome },
  { key: "devices", label: "Devices", href: "/devices", icon: FiCpu },
  { key: "wallet", label: "Wallet", href: "/wallet", icon: FiCreditCard },
  { key: "community", label: "Community", href: "/community", icon: FiUsers },
  { key: "visitors", label: "Access", href: "/visitors", icon: FiKey },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-[95] border-t border-white/10 bg-[#06080e]/95 backdrop-blur-xl"
      style={{ paddingBottom: "var(--sab)" }}
      aria-label="Bottom Navigation"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-5 gap-1 px-2 py-2">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className={`rounded-xl px-2 py-2.5 text-center transition ${
                active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5"
              }`}
            >
              <div className="flex justify-center">
                <Icon className="text-[18px]" />
              </div>
              <div className="mt-1 text-[11px] font-medium">{item.label}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

