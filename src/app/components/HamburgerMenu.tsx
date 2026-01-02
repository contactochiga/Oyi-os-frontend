"use client";

import { useEffect, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";

const MENU_ITEMS = [
  "Devices",
  "Scenes",
  "Automations",
  "Access & Security",
  "Energy",
  "Community",
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* TOGGLE BUTTON */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md bg-gray-800/80 text-white backdrop-blur"
      >
        {open ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* BACKDROP (CHATGPT STYLE) */}
      {open && (
        <div
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-md transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* SLIDE PANEL */}
      <aside
        className={`fixed top-0 left-0 h-[100dvh] w-[72%] max-w-[360px] z-[9999]
        transform transition-transform duration-300
        ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          background: "linear-gradient(180deg, #05070C 0%, #0A0D16 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="h-16" />

        <nav className="px-6 mt-10 space-y-2">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item}
              data-delay={i}
              className="menu-item w-full text-left py-3 px-4 rounded-xl
                         text-lg text-white opacity-0 translate-x-[-8px]
                         hover:bg-white/5 transition"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* STAGGER ANIMATION */}
      <style jsx global>{`
        .menu-item {
          animation: slideIn 0.35s ease-out forwards;
        }

        .menu-item[data-delay="0"] {
          animation-delay: 0ms;
        }
        .menu-item[data-delay="1"] {
          animation-delay: 60ms;
        }
        .menu-item[data-delay="2"] {
          animation-delay: 120ms;
        }
        .menu-item[data-delay="3"] {
          animation-delay: 180ms;
        }
        .menu-item[data-delay="4"] {
          animation-delay: 240ms;
        }
        .menu-item[data-delay="5"] {
          animation-delay: 300ms;
        }

        @keyframes slideIn {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
