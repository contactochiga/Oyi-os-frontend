"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LoaderCircle } from "lucide-react";
import { completePasswordReset, requestPasswordReset, verifyPasswordReset } from "@/services/authService";

type Step = "request" | "verify" | "reset" | "done";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const nextEmail = searchParams.get("email") || "";
    const nextToken = searchParams.get("resetToken") || searchParams.get("token") || "";
    const nextCode = searchParams.get("code") || "";
    if (nextEmail) setEmail(nextEmail);
    if (nextToken) {
      setResetToken(nextToken);
      setStep("reset");
      setMessage("Create a new password to finish recovering your account.");
    } else if (nextEmail && nextCode) {
      setCode(nextCode);
      setStep("verify");
      setMessage("Verify the reset code we received from your recovery link.");
    }
  }, [searchParams]);

  const title = useMemo(() => {
    if (step === "verify") return "Check your email.";
    if (step === "reset") return "Create a new password.";
    if (step === "done") return "Password updated.";
    return "Recover your account.";
  }, [step]);

  async function submitRequest() {
    if (!email.trim()) return setErr("Enter the email address on your Oyi account.");
    setLoading(true);
    setErr(null);
    setMessage(null);
    const result = await requestPasswordReset(email.trim());
    setLoading(false);
    if (result?.error) return setErr(result.error);
    setStep("verify");
    setMessage("If that email belongs to an Oyi account, a reset code has been sent.");
  }

  async function submitVerify() {
    if (!email.trim()) return setErr("Enter your account email.");
    if (!code.trim()) return setErr("Enter the reset code.");
    setLoading(true);
    setErr(null);
    const result = await verifyPasswordReset(email.trim(), code.trim());
    setLoading(false);
    if (result?.error || !result?.resetToken) return setErr(result?.error || "That reset code is invalid or expired.");
    setResetToken(result.resetToken);
    setStep("reset");
    setMessage("Code verified. Choose a new password for your account.");
  }

  async function submitReset() {
    if (!resetToken) return setErr("This reset session has expired. Request a new code.");
    if (password.length < 8) return setErr("Use at least 8 characters for your new password.");
    if (password !== confirmPassword) return setErr("The two passwords do not match.");
    setLoading(true);
    setErr(null);
    const result = await completePasswordReset({ email: email.trim(), resetToken, password });
    setLoading(false);
    if (result?.error) return setErr(result.error);
    setStep("done");
    setMessage("Your password has been changed. You can sign in with it now.");
  }

  const primaryAction = step === "request" ? submitRequest : step === "verify" ? submitVerify : submitReset;

  return (
    <main className="min-h-screen overflow-hidden bg-[#02060b] text-white">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-[calc(26px+var(--sat))]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full bg-sky-500/20 blur-3xl" />
          <div className="absolute top-1/4 -right-56 h-[720px] w-[720px] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.06),rgba(7,10,18,0.72)_45%,rgba(7,10,18,0.97)_100%)]" />
        </div>

        <div className="relative w-full max-w-[390px]">
          <Link href="/auth/login" className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-white/46 transition hover:text-white/72">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>

          <div className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-white/[0.045] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="oyi-orb grid h-20 w-20 place-items-center rounded-full text-[18px] font-semibold tracking-[-0.08em]">Oyi</div>
              <div className="mt-5 text-[22px] font-semibold tracking-[-0.05em] text-white">{title}</div>
              <div className="mt-1 text-xs leading-5 text-white/45">
                {step === "done" ? "Your account is ready again." : "We will help you get back into your resident account safely."}
              </div>
            </div>

            {step === "done" ? (
              <div className="mt-6 space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
                {message ? <p className="text-sm text-white/62">{message}</p> : null}
                <button type="button" onClick={() => router.replace("/auth/login")} className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-black transition active:scale-[0.99]">
                  Sign in
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading || step === "reset"}
                  className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
                />

                {step === "verify" ? (
                  <input
                    type="text"
                    placeholder="Reset code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="one-time-code"
                    disabled={loading}
                    className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
                  />
                ) : null}

                {step === "reset" ? (
                  <>
                    <input
                      type="password"
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={loading}
                      className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={loading}
                      className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 disabled:opacity-60"
                    />
                  </>
                ) : null}

                {message ? <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
                {err ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div> : null}

                <button
                  onClick={primaryAction}
                  disabled={loading}
                  type="button"
                  className="w-full rounded-2xl py-3 text-sm font-semibold transition active:scale-[0.99] disabled:opacity-50"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.18) 100%), var(--brand)",
                    color: "#fff",
                    boxShadow: "0 10px 26px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.10) inset",
                  }}
                >
                  {loading ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Working...</span> : step === "request" ? "Send reset code" : step === "verify" ? "Verify code" : "Update password"}
                </button>

                {step !== "request" ? (
                  <button type="button" onClick={() => { setStep("request"); setResetToken(""); setCode(""); setErr(null); setMessage(null); }} className="w-full py-2 text-xs font-medium text-white/38 transition hover:text-white/60">
                    Request a new code
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
