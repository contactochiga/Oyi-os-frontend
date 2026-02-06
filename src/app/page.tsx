// src/app/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen text-white">
      {/* Background (calm, not plain) */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        <div className="pointer-events-none absolute said inset-0">
          {/* brand glow */}
          <div
            className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(circle at center, var(--brand) 0%, transparent 60%)",
            }}
          />
          {/* cool neutral glow */}
          <div
            className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(circle at center, rgba(148,163,184,0.55) 0%, transparent 62%)",
            }}
          />
          {/* deep vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.65) 45%, rgba(7,10,18,0.95) 100%)",
            }}
          />
          {/* subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage:
                "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
              WebkitMaskImage:
                "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            }}
          />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
            {/* Top micro highlight */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            <div className="flex flex-col items-center text-center">
              {/* Logo */}
              <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/20 grid place-items-center overflow-hidden">
                <div className="relative h-10 w-10">
                  <Image
                    src="/oyi-logo-transparent.png"
                    alt="Oyi OS Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              <div className="mt-5 text-2xl font-semibold tracking-wide">
                OYI&nbsp;OS
              </div>

              <div className="mt-1 text-sm text-white/55">
                The operating system for smart living
              </div>

              <p className="mt-4 text-sm text-white/45 leading-relaxed px-1">
                Control your home and estate through one intelligent interface.
              </p>

              {/* Actions */}
              <div className="w-full mt-6 grid gap-3">
                {/* Primary (brand color, not red) */}
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="w-full py-3 rounded-2xl font-semibold text-sm transition active:scale-[0.99] disabled:opacity-60"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                    color: "#fff",
                    boxShadow:
                      "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                  }}
                  type="button"
                >
                  Get started
                </button>

                {/* Secondary (neutral glass) */}
                <button
                  onClick={() => router.push("/auth/login")}
                  className="w-full py-3 rounded-2xl border border-white/10 bg-white/10 text-white/85 text-sm font-semibold hover:bg-white/15 transition active:scale-[0.99]"
                  type="button"
                >
                  I already have access
                </button>
              </div>

              {/* Trust hint */}
              <div className="mt-5 text-[11px] text-white/35">
                Secure • Private • Estate-native
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[11px] text-white/30">
            Infrastructure-grade estate control
          </div>
        </div>
      </div>
    </main>
  );
}
