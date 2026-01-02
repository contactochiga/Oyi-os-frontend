"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      {/* TOGGLE */}
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md bg-gray-800 text-white"
      >
        {open ? <FiX size={22} /> : <FiMenu size={22} />}
      </button>

      {/* FULLSCREEN MENU */}
      <aside
        className={`fixed inset-0 z-[9999] transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "linear-gradient(180deg, #05070C 0%, #090B12 100%)",
        }}
      >
        <div className="h-16" />

        <nav className="px-6 mt-8 space-y-2">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item}
              style={{
                animation: "slideIn 0.35s ease-out forwards",
                animationDelay: i * 60 + "ms",
              }}
              className="w-full text-left py-3 px-4 rounded-xl
                         text-lg text-white opacity-0 translate-x-[-8px]
                         hover:bg-white/5 transition"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <style jsx global>{`
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
