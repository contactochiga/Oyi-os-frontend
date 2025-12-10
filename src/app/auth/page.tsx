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
  const { setUser } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (mode === "signup") {
        const res = await signUpWithEmail(email, password, fullName);

        if (res?.token) {
          localStorage.setItem("ochiga_token", res.token);
          localStorage.setItem("ochiga_user", JSON.stringify(res.user));
          setUser(res.user);
          router.push("/home");
        } else {
          alert(res?.error || "Signup failed");
        }
      } else {
        const res = await loginWithEmail(email, password);

        if (res?.token) {
          localStorage.setItem("ochiga_token", res.token);
          localStorage.setItem("ochiga_user", JSON.stringify(res.user));
          setUser(res.user);

          if (res.user?.role === "estate" || res.user?.role === "admin") {
            router.push("/estate");
          } else {
            router.push("/home");
          }
        } else {
          alert(res?.error || "Login failed");
        }
      }
    } catch (err: any) {
      alert(err.message || "Auth failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow">
        <h2 className="text-xl font-semibold mb-4">
          {mode === "login" ? "Sign in to Oyi" : "Create your Oyi account"}
        </h2>

        <div className="flex gap-2 mb-4">
          <button onClick={signInWithGoogle} className="flex-1 py-2 rounded-md border border-gray-300">
            Sign in with Google
          </button>

          <button onClick={signInWithApple} className="flex-1 py-2 rounded-md border border-gray-300">
            Sign in with Apple
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          )}

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-3 py-2 rounded bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />

          <div className="flex items-center justify-between">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
              {mode === "login" ? "Login" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm text-gray-500"
            >
              {mode === "login" ? "Create account" : "Have an account? Login"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
