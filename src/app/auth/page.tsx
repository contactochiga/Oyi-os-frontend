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
  const [showEmailForm, setShowEmailForm] = useState(false);

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

      localStorage.setItem("ochiga_token", res.token);
      localStorage.setItem("ochiga_user", JSON.stringify(res.user));
      setUser(res.user);

      router.push(res.user.role === "estate" ? "/estate" : "/home");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col justify-end bg-white dark:bg-black px-6 pb-14">

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <p className="text-red-500 text-center text-sm mb-3">{errorMsg}</p>
      )}

      <div className="w-full bg-black rounded-3xl p-6 space-y-3">
        
        {/* Continue with Apple */}
        <button
          onClick={signInWithApple}
          className="w-full py-3 bg-white text-black font-medium rounded-xl flex items-center justify-center"
        >
           &nbsp; Continue with Apple
        </button>

        {/* Continue with Google */}
        <button
          onClick={signInWithGoogle}
          className="w-full py-3 bg-gray-900 text-white font-medium rounded-xl border border-gray-700 flex items-center justify-center"
        >
          <span className="text-lg">G</span> &nbsp; Continue with Google
        </button>

        {/* Continue with Email */}
        <button
          onClick={() => setShowEmailForm(true)}
          className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl"
        >
          Continue with Email
        </button>

        {/* EMAIL FORM */}
        {showEmailForm && (
          <form onSubmit={handleSubmit} className="space-y-3 mt-3">

            {mode === "signup" && (
              <input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-3 bg-gray-900 text-white rounded-xl border border-gray-700"
              />
            )}

            <input
              placeholder="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-3 bg-gray-900 text-white rounded-xl border border-gray-700"
            />

            <input
              placeholder="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-3 bg-gray-900 text-white rounded-xl border border-gray-700"
            />

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                ? "Log in"
                : "Sign up"}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full text-center text-sm text-gray-400"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Log in"}
            </button>

          </form>
        )}
      </div>
    </main>
  );
}
