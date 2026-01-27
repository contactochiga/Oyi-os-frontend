"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  return data;
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
              className="h-12 w-full rounded-xl bg-gray-800 border border-white/10 text-center text-lg font-semibold outline-none focus:border-white/25"
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
  const { setSession } = useSessionStore();

  const next = useMemo(() => searchParams.get("next") || "/home", [searchParams]);

  const [step, setStep] = useState<Step>("form");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // single timer: expiry
  const [expiresLeft, setExpiresLeft] = useState(0);

  // resend lock: 60s (no second timer displayed)
  const [resendLocked, setResendLocked] = useState(true);

  const cleanEmail = email.trim().toLowerCase();

  // tick expiry timer only when in otp step
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

      await verifyOtp(cleanEmail, code);

      const res = await signUpWithEmail(cleanEmail, password, fullName.trim());
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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm overflow-hidden">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-gray-400 mt-1">
          {step === "form" ? "Continue with email." : "Enter the verification code we sent."}
        </p>

        {/* Slide wrapper */}
        <div
          className={`mt-6 flex w-[200%] transition-transform duration-300 ease-out ${
            step === "otp" ? "-translate-x-1/2" : "translate-x-0"
          }`}
        >
          {/* FORM */}
          <div className="w-1/2 pr-4 flex flex-col gap-3">
            <input
              className="bg-gray-800 rounded-lg p-3 outline-none"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />

            <input
              className="bg-gray-800 rounded-lg p-3 outline-none"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />

            <input
              className="bg-gray-800 rounded-lg p-3 outline-none"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {err && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {err}
              </div>
            )}

            <button
              className="bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
              onClick={startOtp}
              disabled={loading || !fullName.trim() || !email.trim() || !password}
              type="button"
            >
              {loading ? "Please wait..." : "Continue"}
            </button>

            <button
              onClick={() => router.push("/auth/login")}
              className="text-sm text-gray-400 mt-2 hover:text-gray-300"
              type="button"
            >
              Already have access? Log in
            </button>
          </div>

          {/* OTP */}
          <div className="w-1/2 pl-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-gray-300">We sent a 6-digit code to</div>
              <div className="mt-1 text-sm font-medium text-white break-all underline underline-offset-4">
                {cleanEmail || "—"}
              </div>

              <Otp6 value={otp} onChange={setOtp} disabled={loading} />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-400">Expires in {formatMMSS(expiresLeft)}</div>

                <button
                  type="button"
                  onClick={resendNow}
                  disabled={loading || resendLocked}
                  className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs transition ${
                    loading || resendLocked
                      ? "text-gray-600 cursor-not-allowed"
                      : "text-gray-200 hover:bg-white/5"
                  }`}
                  aria-disabled={loading || resendLocked}
                  title={resendLocked ? "You can resend after 1 minute" : "Resend code"}
                >
                  <ResendIcon className="opacity-90" />
                  <span>Resend</span>
                </button>
              </div>

              {err && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {err}
                </div>
              )}

              <button
                className="mt-5 w-full bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
                onClick={verifyAndCreate}
                disabled={loading || otp.replace(/\D/g, "").length !== 6}
                type="button"
              >
                {loading ? "Verifying..." : "Verify & Create account"}
              </button>

              <button
                className={`mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition ${
                  loading ? "opacity-50 cursor-not-allowed" : "hover:bg-white/10"
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
              className="text-sm text-gray-400 mt-4 hover:text-gray-300"
              type="button"
            >
              Already have access? Log in
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
