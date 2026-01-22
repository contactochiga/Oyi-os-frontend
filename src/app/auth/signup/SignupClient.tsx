"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUpWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import { useSessionStore } from "@/store/useSessionStore";

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { setSession } = useSessionStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const res = await signUpWithEmail(email.trim(), password, fullName.trim());

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

      const next = searchParams.get("next");
      router.replace(next || "/home");
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
        <p className="text-sm text-gray-400">Continue with email.</p>

        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="bg-gray-800 rounded-lg p-3 outline-none"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <button
          className="bg-[#E11D2E] py-3 rounded-xl font-medium hover:bg-[#C81E2A] transition disabled:opacity-60"
          onClick={submit}
          disabled={loading || !fullName || !email || !password}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <button
          onClick={() => router.push("/auth/login")}
          className="text-sm text-gray-400 mt-2 hover:text-gray-300"
        >
          Already have access? Log in
        </button>
      </div>
    </main>
  );
}
