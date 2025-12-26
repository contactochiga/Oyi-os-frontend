"use client";
import { useRouter } from "next/navigation";

export default function Signup() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950 text-white px-6">
      <div className="w-full max-w-sm flex flex-col gap-5">

        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-gray-400">
          Choose how you’d like to continue.
        </p>

        {/* Social auth */}
        <button className="bg-gray-800 py-3 rounded-xl font-medium">
          Continue with Apple
        </button>

        <button className="bg-gray-800 py-3 rounded-xl font-medium">
          Continue with Google
        </button>

        <div className="text-xs text-gray-500 text-center my-2">
          ──────── or continue with email ────────
        </div>

        {/* Email auth */}
        <input className="bg-gray-800 rounded-lg p-3" placeholder="Full name" />
        <input className="bg-gray-800 rounded-lg p-3" placeholder="Email" />
        <input
          className="bg-gray-800 rounded-lg p-3"
          placeholder="Password"
          type="password"
        />

        <button className="bg-[#E11D2E] py-3 rounded-xl font-medium">
          Create account
        </button>

        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          Creating an account does not automatically grant estate access.
          Your estate administrator will provide access.
        </p>

        <button
          onClick={() => router.push("/auth/login")}
          className="text-sm text-gray-400 mt-2"
        >
          Already have access? Log in
        </button>

      </div>
    </main>
  );
}
