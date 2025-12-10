"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  signUpWithEmail,
  loginWithEmail,
  signInWithGoogle,
  signInWithApple
} from "../../services/authService";

import useAuth from "../../hooks/useAuth";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { setUser } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      let res;

      if (mode === "signup") {
        res = await signUpWithEmail(email, password, fullName);
      } else {
        res = await loginWithEmail(email, password);
      }

      if (!res?.token) {
        setErrorMsg(res?.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Save user session
      localStorage.setItem("ochiga_token", res.token);
      localStorage.setItem("ochiga_user", JSON.stringify(res.user));
      setUser(res.user);

      // Redirect based on role
      if (res.user?.role === "estate" || res.user?.role === "admin") {
        router.push("/estate");
      } else {
        router.push("/home");
      }

    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-6 shadow-lg">

        <h2 className="text-2xl font-bold mb-6">
          {mode === "login" ? "Sign in to Oyi" : "Create your Oyi account"}
        </h2>

        {/* ERROR MESSAGE */}
        {errorMsg && (
          <p className="text-red-500 text-sm mb-3">{errorMsg}</p>
        )}

        {/* SOCIAL LOGIN BUTTONS */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={signInWithGoogle}
            type="button"
            className="flex-1 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
          >
            Sign in with Google
          </button>

          <button
            onClick={signInWithApple}
            type="button"
            className="flex-1 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
          >
            Sign in with Apple
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-3">

          {mode === "signup" && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full Name"
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
          />

          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? "Please wait…" : (mode === "login" ? "Login" : "Create account")}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full mt-2 text-sm text-blue-600 dark:text-blue-400"
          >
            {mode === "login" ? "Create an account" : "Already have an account? Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
