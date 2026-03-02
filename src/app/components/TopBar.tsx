// src/app/components/TopBar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import NotificationBell from "@/app/components/NotificationBell";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import useAuth from "@/hooks/useAuth";

export default function TopBar() {
  const router = useRouter();
  const { logout } = useAuth() as any;

  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent | TouchEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;

      const insideMenu = menuRef.current?.contains(t);
      const insideBtn = btnRef.current?.contains(t);
      if (!insideMenu && !insideBtn) setOpen(false);
    }

    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown as any);
    };
  }, [open]);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function go(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <>
      <header
        className="
          fixed left-0 right-0 z-[80]
          border-b border-white/10
          bg-[#0B1220]/95
          backdrop-blur-xl
        "
        style={{
          top: 0,
          height: "calc(64px + var(--sat))",
          paddingTop: "var(--sat)",

          // ✅ iOS compositor hardeners
          isolation: "isolate",
          transform: "translateZ(0)",
        }}
      >
        <div className="h-16 w-full px-4 flex items-center">
          <div className="flex items-center gap-3">
            <HamburgerMenu />

            <div className="h-8 w-8 rounded-lg overflow-hidden border border-white/10 bg-black/20">
              <Image
                src="/oyi-logo-transparent.png"
                alt="Oyi"
                width={32}
                height={32}
                className="h-full w-full object-contain"
                priority
              />
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* ✅ FIX: clickable + toggles menu */}
            <button
              ref={btnRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg p-2 hover:bg-white/10 transition active:scale-[0.98]"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <EllipsisVerticalIcon className="h-5 w-5 text-zinc-300" />
            </button>
          </div>
        </div>
      </header>

      {/* ✅ Menu layer (above everything) */}
      {open ? (
        <div className="fixed inset-0 z-[200]">
          {/* invisible backdrop to catch taps */}
          <button
            type="button"
            className="absolute inset-0 bg-transparent"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />

          <div
            ref={menuRef}
            role="menu"
            className="
              absolute right-4
              rounded-2xl border border-white/10
              bg-[#0a0c12]/95 backdrop-blur-xl
              shadow-[0_18px_60px_rgba(0,0,0,0.55)]
              overflow-hidden
              min-w-[220px]
            "
            style={{
              top: "calc(64px + var(--sat) + 10px)",
              transform: "translateZ(0)",
            }}
          >
            <MenuItem label="Profile" onClick={() => go("/settings?section=profile")} />
            <MenuItem label="Preferences" onClick={() => go("/settings?section=settings")} />
            <div className="h-px bg-white/10" />
            <MenuItem label="Help" onClick={() => go("/support")} />
            <MenuItem
              label="Log out"
              danger
              onClick={() => {
                setOpen(false);
                logout?.();
              }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={[
        "w-full text-left px-4 py-3 text-sm transition",
        danger
          ? "text-red-300 hover:bg-red-500/10"
          : "text-white/85 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
