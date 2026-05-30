"use client";

import { FiX } from "react-icons/fi";

export default function SlideUpSettings({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end">
      <div className="w-full rounded-t-2xl bg-gray-900 border-t border-gray-700 p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md bg-gray-800 hover:bg-gray-700"
          >
            <FiX className="text-white" />
          </button>
        </div>

        <div className="space-y-4 text-gray-300 text-sm">
          <a href="/profile" className="block p-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
            Preferences
          </a>
          <a href="/profile" className="block p-4 rounded-lg bg-gray-800 hover:bg-gray-700 transition">
            Estate & Unit
          </a>
        </div>
      </div>
    </div>
  );
}
