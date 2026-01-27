"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-7">
        {/* Logo */}
        <div className="w-20 h-20 relative mb-1">
          <Image
            src="/oyi-logo-transparent.png"
            alt="Oyi OS Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Wordmark */}
        <div className="text-3xl font-semibold tracking-wide">OYI&nbsp;OS</div>

        {/* Tagline */}
        <div className="text-lg text-gray-300">
          The operating system for smart living
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 leading-relaxed px-2">
          Control your home and estate through one intelligent interface.
        </p>

        {/* Subtle brand divider */}
        <div className="w-8 h-[2px] bg-[#E11D2E]/40 rounded-full my-1" />

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-3">
          <button
            onClick={() => router.push("/auth/signup")}
            className="
              w-full py-3 rounded-xl
              bg-[#E11D2E]
              hover:bg-[#C81E2A]
              transition
              font-medium
              shadow-sm
            "
          >
            Get started
          </button>

          <button
            onClick={() => router.push("/auth/login")}
            className="
              w-full py-3 rounded-xl
              bg-gray-800
              hover:bg-gray-700
              transition
              font-medium
            "
          >
            I already have access
          </button>
        </div>

        {/* Trust hint */}
        <div className="text-xs text-gray-500 mt-6 opacity-80">
          Secure · Private · Estate-native
        </div>
      </div>
    </main>
  );
}
