"use client";
import { useState } from "react";
import { FiMenu } from "react-icons/fi";

export default function HamburgerMenu({ onToggle }: { onToggle?: (o:boolean)=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { setOpen(!open); onToggle?.(!open); }} className="p-2 bg-gray-800/50 rounded">
        <FiMenu />
      </button>
      {open && <div className="fixed inset-0 bg-black/40" onClick={() => { setOpen(false); onToggle?.(false); }} />}
    </>
  );
}
