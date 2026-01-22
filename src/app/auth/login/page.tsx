"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithEmail } from "@/services/authService";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import useAuth from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();

  const returnTo = searchParams.get("returnTo") || "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setLoading(true);

    try {
      const res = await loginWithEmail(email.trim(), password);

      if (res?.error || !res?.token) {
        setErr(res?.error || "Login failed");
        return;
      }

      const decoded = decodeToken(res.token);
      if (!decoded || isExpired(decoded)) {
        setErr("Invalid session token");
        return;
      }

      setCookie("oyi_consumer_token", res.token, 30);
      setSession(res.token, res.user ?? undefined);

      router.replace(returnTo);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-gray-400">Sign in to continue.</p>
        </div>

        <button
          className="w-full bg-gray-800 hover:bg-gray-700 transition py-3 rounded-xl font-medium opacity-60"
          disabled
        >
          Continue with Apple (soon)
        </button>

        <button
          className="w-full bg-gray-800 hover:bg-gray-700 transition py-3 rounded-xl font-medium opacity-60"
          disabled
        >
          Continue with Google (soon)
        </button>

        <div className="text-xs text-gray-500 text-center my-1">
          ───────── or sign in with email ─────────
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-800 rounded-lg p-3 outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-800 rounded-lg p-3 outline-none"
        />

        {err && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <button
          className="w-full bg-[#E11D2E] hover:bg-[#C81E2A] transition py-3 rounded-xl font-medium shadow-sm disabled:opacity-60"
          onClick={submit}
          disabled={loading || !email || !password}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <button
          onClick={() =>
            router.push(`/auth/signup?returnTo=${encodeURIComponent(returnTo)}`)
          }
          className="text-sm text-gray-400 hover:text-gray-300 transition"
        >
          Don’t have access yet? Create an account
        </button>

        <div className="text-[11px] text-gray-500">
          Backend:{" "}
          <span className="text-gray-300">{process.env.NEXT_PUBLIC_API_URL}</span>
        </div>
      </div>
    </main>
  );
}
