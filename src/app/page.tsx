"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-6">

        {/* Logo */}
        <div className="w-20 h-20 relative">
          <Image
            src="/oyi-logo.png"   // place logo in /public/oyi-logo.png
            alt="Oyi OS Logo"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* Wordmark */}
        <div className="text-3xl font-semibold tracking-wide">
          OYI&nbsp;OS
        </div>

        {/* Tagline */}
        <div className="text-lg text-gray-300">
          The operating system for smart living
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 leading-relaxed">
          Control your home and estate through one intelligent interface.
        </p>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 mt-4">
          <button
            onClick={() => router.push("/auth/signup")}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-medium"
          >
            Get started
          </button>

          <button
            onClick={() => router.push("/auth/login")}
            className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 transition font-medium"
          >
            I already have access
          </button>
        </div>

        {/* Trust hint */}
        <div className="text-xs text-gray-500 mt-6">
          Secure · Private · Estate-native
        </div>

      </div>
    </main>
  );
}
