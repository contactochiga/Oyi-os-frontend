"use client";
import React from "react";

export default function LayoutWrapper({ children, menuOpen = false }: { children: React.ReactNode; menuOpen?: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      {children}
    </div>
  );
}
