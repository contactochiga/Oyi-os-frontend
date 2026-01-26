"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

type Step = "form" | "otp";

function getApiBase() {
  // supports either naming convention
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  );
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
  const [info, setInfo] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  async function startOtp() {
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      if (!cleanEmail || !cleanEmail.includes("@")) {
        setErr("Enter a valid email");
        return;
      }
      if (!fullName.trim() || !password) {
        setErr("Fill full name and password");
        return;
      }

      await sendOtp(cleanEmail);
      setStep("otp");
      setInfo(`OTP sent to ${cleanEmail}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndCreate() {
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      if (!otp.trim() || otp.trim().length < 4) {
        setErr("Enter the OTP code");
        return;
      }

      await verifyOtp(cleanEmail, otp.trim());

      // ✅ now create account using your existing flow
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

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-gray-400">
          {step === "form" ? "Continue with email." : "Enter the verification code we sent."}
        </p>

        {/* FORM */}
        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={loading || step === "otp"}
        />

        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || step === "otp"}
        />

        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading || step === "otp"}
        />

        {/* OTP */}
        {step === "otp" && (
          <>
            <input
              className="bg-gray-800 rounded-lg p-3 outline-none tracking-widest"
              placeholder="OTP code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={loading}
            />

            <button
              className="bg-gray-700 py-3 rounded-xl font-medium hover:bg-gray-600 transition disabled:opacity-60"
              onClick={startOtp}
              disabled={loading}
              type="button"
            >
              {loading ? "..." : "Resend code"}
            </button>

            <button
              className="bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
              onClick={() => setStep("form")}
              disabled={loading}
              type="button"
            >
              Change email
            </button>
          </>
        )}

        {info && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {info}
          </div>
        )}

        {err && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* PRIMARY BUTTON */}
        {step === "form" ? (
          <button
            className="bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
            onClick={startOtp}
            disabled={loading || !fullName || !email || !password}
            type="button"
          >
            {loading ? "Sending code..." : "Send verification code"}
          </button>
        ) : (
          <button
            className="bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
            onClick={verifyAndCreate}
            disabled={loading || otp.trim().length < 4}
            type="button"
          >
            {loading ? "Verifying..." : "Verify & Create account"}
          </button>
        )}

        <button
          onClick={() => router.push("/auth/login")}
          className="text-sm text-gray-400 mt-2 hover:text-gray-300"
          type="button"
        >
          Already have access? Log in
        </button>
      </div>
    </main>
  );
}
