// src/app/auth/signup/SignupClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

type Step = "form" | "otp";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOtp(email: string) {
  const API = getApiBase();
  if (!API) throw new Error("Missing NEXT_PUBLIC_API_URL");

  const res = await fetch(`${API}/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, purpose: "signup" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "Failed to send OTP");
  return data;
}

async function verifyOtp(email: string, code: string) {
  const API = getApiBase();
  if (!API) throw new Error("Missing NEXT_PUBLIC_API_URL");

  const res = await fetch(`${API}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, purpose: "signup" }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || data?.error || "OTP verification failed");
  return data as { ok?: boolean; otpToken?: string; message?: string };
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function ResendIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-14.3 5M4 12A8 8 0 0 1 18.3 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 3v4h-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 21v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusDot({ ok }: { ok: boolean | null }) {
  const title = ok === null ? "Checking service health" : ok ? "Service healthy" : "Service unavailable";
  const cls =
    ok === null
      ? "bg-white/25"
      : ok
      ? "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]"
      : "bg-red-400 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]";

  return (
    <span className="inline-flex items-center" title={title} aria-label={title}>
      <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
    </span>
  );
}

/** 6-box OTP input */
function Otp6({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  function setAt(index: number, char: string) {
    const chars = value.split("");
    while (chars.length < 6) chars.push("");
    chars[index] = char;
    onChange(chars.join("").slice(0, 6));
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    onChange(text.padEnd(6, "").slice(0, 6));
    const last = Math.min(text.length - 1, 5);
    inputsRef.current[last]?.focus();
  }

  return (
    <div className="mt-4" onPaste={handlePaste}>
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const v = value[i] || "";
          return (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el;
              }}
              value={v}
              disabled={disabled}
              inputMode="numeric"
              maxLength={1}
              className="h-12 w-full rounded-xl bg-black/20 border border-white/10 text-center text-lg font-semibold outline-none focus:border-white/25 text-white"
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 1);
                setAt(i, next);
                if (next && i < 5) inputsRef.current[i + 1]?.focus();
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace") {
                  if (value[i]) {
                    setAt(i, "");
                    return;
                  }
                  if (i > 0) {
                    inputsRef.current[i - 1]?.focus();
                    setAt(i - 1, "");
                  }
                }
                if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
                if (e.key === "ArrowRight" && i < 5) inputsRef.current[i + 1]?.focus();
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, hydrate, token } = useSessionStore();

  const next = useMemo(() => searchParams.get("next") || "/home", [searchParams]);

  const [step, setStep] = useState<Step>("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [expiresLeft, setExpiresLeft] = useState(0);
  const [resendLocked, setResendLocked] = useState(true);

  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded || isExpired(decoded)) return;
    router.replace("/home");
  }, [token, router]);

  useEffect(() => {
    const API = getApiBase();
    if (!API) {
      setBackendOk(false);
      return;
    }

    let cancelled = false;
    setBackendOk(null);

    (async () => {
      try {
        const res = await fetch(`${API}/health`, { method: "GET" });
        if (cancelled) return;
        setBackendOk(res.ok);
      } catch {
        if (cancelled) return;
        setBackendOk(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (step !== "otp") return;
    const t = setInterval(() => setExpiresLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  function startOtpSession() {
    setExpiresLeft(10 * 60);
    setResendLocked(true);
    window.setTimeout(() => setResendLocked(false), 60 * 1000);
  }

  async function startOtp() {
    setErr(null);
    setLoading(true);
    try {
      if (!fullName.trim() || !password) {
        setErr("Fill full name and password");
        return;
      }
      if (!isValidEmail(cleanEmail)) {
        setErr("Enter a valid email");
        return;
      }

      await sendOtp(cleanEmail);

      setOtp("");
      setStep("otp");
      startOtpSession();
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function resendNow() {
    if (loading) return;
    if (resendLocked) return;

    setErr(null);
    setLoading(true);
    try {
      await sendOtp(cleanEmail);
      setOtp("");
      startOtpSession();
    } catch (e: any) {
      setErr(e?.message || "Failed to resend OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setErr(null);
    setLoading(true);
    try {
      const code = otp.replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) {
        setErr("Enter the 6-digit OTP code");
        return;
      }

      const v = await verifyOtp(cleanEmail, code);
      const otpToken = v?.otpToken;

      if (!otpToken) {
        setErr("OTP verified, but no token returned. Please try again.");
        return;
      }

      const res = await signUpWithEmail(cleanEmail, password, fullName.trim(), otpToken);

      if (res?.error || !res?.token) {
        setErr(res?.error || "Signup failed");
        return;
      }

      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setErr("Invalid session token");
        return;
      }

      setCookie("oyi_consumer_token", res.token, 30);
      setSession(res.token);

      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setErr(null);
    setOtp("");
    setExpiresLeft(0);
    setResendLocked(true);
    setStep("form");
  }

  return (
    <main className="min-h-screen text-white">
      <div className="relative min-h-screen flex items-center justify-center px-6 py-10 overflow-hidden bg-[#070A12]">
        {/* Background (same as landing/login) */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full blur-3xl opacity-25"
            style={{ background: "radial-gradient(circle at center, var(--brand) 0%, transparent 60%)" }}
          />
          <div
            className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full blur-3xl opacity-25"
            style={{
              background: "radial-gradient(circle at center, rgba(148,163,184,0.55) 0%, transparent 62%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(7,10,18,0.72) 45%, rgba(7,10,18,0.97) 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.10]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 35%, black 0%, transparent 65%)",
            }}
          />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-6 shadow-[0_20px_90px_rgba(0,0,0,0.60)] overflow-hidden">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--brand) 35%, rgba(255,255,255,0.35) 50%, var(--brand) 65%, transparent 100%)",
                opacity: 0.55,
              }}
            />

            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-2xl border border-white/10 bg-black/20 grid place-items-center overflow-hidden">
                  <div className="relative h-10 w-10">
                    <Image
                      src="/oyi-logo-transparent.png"
                      alt="OYI Logo"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>

                <div className="mt-5 text-xl font-semibold text-white tracking-wide">OYI</div>
                <div className="mt-1 text-xs text-white/45">{step === "form" ? "Create account" : "Verify email"}</div>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/35">
                  <StatusDot ok={backendOk} />
                  <span>{backendOk === null ? "Checking system…" : backendOk ? "System online" : "System limited"}</span>
                </div>
              </div>

              {/* Slide wrapper */}
              <div
                className={`mt-6 flex w-[200%] transition-transform duration-300 ease-out ${
                  step === "otp" ? "-translate-x-1/2" : "translate-x-0"
                }`}
              >
                {/* FORM */}
                <div className="w-1/2 pr-4 space-y-3">
                  <input
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 disabled:opacity-60"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />

                  <input
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 disabled:opacity-60"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />

                  <input
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 disabled:opacity-60"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />

                  {err && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {err}
                    </div>
                  )}

                  {/* ✅ Brand primary (no old red) */}
                  <button
                    onClick={startOtp}
                    disabled={loading || !fullName.trim() || !cleanEmail || !password}
                    type="button"
                    className="w-full py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                      color: "#fff",
                      boxShadow:
                        "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                    }}
                  >
                    {loading ? "Please wait…" : "Continue"}
                  </button>

                  <button
                    onClick={() => router.push("/auth/login")}
                    className="w-full py-3 rounded-2xl bg-white/10 text-white/85 text-sm font-semibold hover:bg-white/15 transition active:scale-[0.99] border border-white/10"
                    type="button"
                  >
                    Already have access? Log in
                  </button>
                </div>

                {/* OTP */}
                <div className="w-1/2 pl-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/60">We sent a 6-digit code to</div>
                    <div className="mt-1 text-sm font-medium text-white break-all underline underline-offset-4">
                      {cleanEmail || "—"}
                    </div>

                    <Otp6 value={otp} onChange={setOtp} disabled={loading} />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-white/45">Expires in {formatMMSS(expiresLeft)}</div>

                      <button
                        type="button"
                        onClick={resendNow}
                        disabled={loading || resendLocked}
                        className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                          loading || resendLocked
                            ? "text-white/30 cursor-not-allowed"
                            : "text-white/75 hover:bg-white/5"
                        }`}
                        aria-disabled={loading || resendLocked}
                        title={resendLocked ? "You can resend after 1 minute" : "Resend code"}
                      >
                        <ResendIcon className="opacity-90" />
                        <span>Resend</span>
                      </button>
                    </div>

                    {err && (
                      <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {err}
                      </div>
                    )}

                    <button
                      onClick={verifyAndCreate}
                      disabled={loading || otp.replace(/\D/g, "").length !== 6}
                      type="button"
                      className="mt-5 w-full py-3 rounded-2xl text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                        color: "#fff",
                        boxShadow:
                          "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                      }}
                    >
                      {loading ? "Verifying…" : "Verify & Create account"}
                    </button>

                    <button
                      className={`mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold transition ${
                        loading ? "opacity-50 cursor-not-allowed" : "hover:bg-white/15"
                      }`}
                      onClick={changeEmail}
                      disabled={loading}
                      type="button"
                    >
                      Change email
                    </button>
                  </div>

                  <button
                    onClick={() => router.push("/auth/login")}
                    className="mt-4 w-full py-3 rounded-2xl bg-white/5 text-white/60 text-sm border border-white/10 hover:bg-white/10 transition"
                    type="button"
                  >
                    Back to login
                  </button>
                </div>
              </div>

              <div className="mt-5 text-center text-[11px] text-white/30">
                Smart Home • Smart Estate
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
