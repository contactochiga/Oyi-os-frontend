// src/app/page.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen text-white">
      {/* Background (premium, not plain) */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        <div className="pointer-events-none absolute inset-0">
          {/* brand glow */}
          <div
            className="absolute -top-56 -left-56 h-[720px] w-[720px] rounded-full blur-3xl opacity-25"
            style={{
              background: "radial-gradient(circle at center, var(--brand) 0%, transparent 62%)",
            }}
          />
          {/* cool neutral glow */}
          <div
            className="absolute top-1/4 -right-56 h-[760px] w-[760px] rounded-full blur-3xl opacity-20"
            style={{
              background: "radial-gradient(circle at center, rgba(148,163,184,0.60) 0%, transparent 64%)",
            }}
          />
          {/* lower glow for depth */}
          <div
            className="absolute -bottom-72 left-1/3 h-[820px] w-[820px] rounded-full blur-3xl opacity-15"
            style={{
              background: "radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, transparent 62%)",
            }}
          />

          {/* deep vignette */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 28%, rgba(255,255,255,0.08) 0%, rgba(7,10,18,0.62) 42%, rgba(7,10,18,0.96) 100%)",
            }}
          />

          {/* subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 66%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 66%)",
            }}
          />

          {/* subtle scanline/noise vibe */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 6px)",
              maskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Card */}
        <div className="relative w-full max-w-sm">
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            {/* Top micro highlight */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            {/* faint inner sheen */}
            <div
              className="pointer-events-none absolute -inset-px rounded-3xl"
              style={{
                background:
                  "radial-gradient(circle at 30% 10%, rgba(255,255,255,0.10) 0%, transparent 45%)",
              }}
            />

            <div className="flex flex-col items-center text-center relative">
              {/* Logo */}
              <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/20 grid place-items-center overflow-hidden">
                <div className="relative h-10 w-10">
                  <Image
                    src="/oyi-logo-transparent.png"
                    alt="Oyi Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* ✅ OS -> OE */}
              <div className="mt-5 text-2xl font-semibold tracking-wide">OYI&nbsp;OE</div>

              <div className="mt-1 text-sm text-white/55">Estate-native control</div>

              <p className="mt-4 text-sm text-white/45 leading-relaxed px-1">
                Control your home and estate through one intelligent interface.
              </p>

              {/* Actions */}
              <div className="w-full mt-6 grid gap-3">
                {/* Primary */}
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

                {/* Secondary */}
                <button
                  onClick={() => router.push("/auth/login")}
                  className="w-full py-3 rounded-2xl border border-white/10 bg-white/10 text-white/85 text-sm font-semibold hover:bg-white/15 transition active:scale-[0.99]"
                  type="button"
                >
                  I already have access
                </button>
              </div>

              {/* Trust hint */}
              <div className="mt-5 text-[11px] text-white/35">Secure • Private • Estate-native</div>
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
