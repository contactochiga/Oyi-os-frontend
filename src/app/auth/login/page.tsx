"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-sm text-gray-400">
            Sign in to continue.
          </p>
        </div>

        {/* Social auth */}
        <button
          className="w-full bg-gray-800 hover:bg-gray-700 transition py-3 rounded-xl font-medium"
          onClick={() => {
            // TODO: Apple sign-in
          }}
        >
          Continue with Apple
        </button>

        <button
          className="w-full bg-gray-800 hover:bg-gray-700 transition py-3 rounded-xl font-medium"
          onClick={() => {
            // TODO: Google sign-in
          }}
        >
          Continue with Google
        </button>

        {/* Divider */}
        <div className="text-xs text-gray-500 text-center my-1">
          ───────── or sign in with email ─────────
        </div>

        {/* Email login */}
        <input
          type="email"
          placeholder="Email"
          className="bg-gray-800 rounded-lg p-3 outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          className="bg-gray-800 rounded-lg p-3 outline-none"
        />

        <button
          className="w-full bg-[#E11D2E] hover:bg-[#C81E2A] transition py-3 rounded-xl font-medium shadow-sm"
          onClick={() => {
            // TODO: Email/password login
          }}
        >
          Sign in
        </button>

        {/* Footer actions */}
        <div className="flex flex-col gap-2 mt-2">
          <button
            onClick={() => router.push("/auth/signup")}
            className="text-sm text-gray-400 hover:text-gray-300 transition"
          >
            Don’t have access yet? Create an account
          </button>
        </div>

      </div>
    </main>
  );
}
