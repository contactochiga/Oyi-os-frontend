"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  CameraOff,
  CheckCircle2,
  Home,
  Link2,
  LoaderCircle,
  MapPin,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { activateInvite, type InvitePreview, validateInvite } from "@/services/authService";
import { extractInviteToken } from "@/lib/inviteToken";
import { establishConsumerSession } from "@/services/sessionBootstrap";
import { markOnboardingTourPending } from "@/services/onboardingTour";
import { scanInviteQrCode } from "@/services/inviteScanner";
import { useSessionStore } from "@/store/useSessionStore";

function friendlyInviteError(message?: string) {
  const value = String(message || "").toLowerCase();
  if (value.includes("expired")) return "This invitation has expired. Ask your estate team to resend it.";
  if (value.includes("revoked")) return "This invitation was revoked. Ask your estate team for a new setup link.";
  if (value.includes("accepted")) return "This invitation has already been used. Sign in if your account is active.";
  if (value.includes("username")) return "That username is unavailable. Choose another one.";
  if (value.includes("password")) return String(message);
  if (value.includes("not found") || value.includes("token")) return "We could not recognize this invitation. Check the link or ask your estate team to resend it.";
  return "Oyi could not validate this invitation right now. Check your connection and try again.";
}

function formatExpiry(value?: string) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function InviteActivationClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useSessionStore();
  const [entry, setEntry] = useState(params.get("token") || "");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);

  async function runValidation(rawEntry = entry) {
    const token = extractInviteToken(rawEntry);
    if (!token) {
      setError("Paste your setup link or enter your invite token.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await validateInvite(token);
      if ("error" in response) {
        setPreview(null);
        setError(friendlyInviteError(response.error));
        return;
      }
      setEntry(token);
      setPreview(response.preview);
      setCameraMessage(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const token = params.get("token");
    if (token) void runValidation(token);
    // Query token is intentionally validated once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function scanInvitation() {
    setScanBusy(true);
    setError(null);
    const result = await scanInviteQrCode();
    setScanBusy(false);
    if (!result.ok) {
      setCameraMessage(result.message);
      return;
    }
    setEntry(result.value);
    setCameraMessage(null);
    await runValidation(result.value);
  }

  useEffect(() => {
    if (params.get("mode") === "scan") void scanInvitation();
    // Scanner is intentionally opened once when the resident chooses Scan Invitation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function activate() {
    const token = extractInviteToken(entry);
    if (!preview || !token) return;
    if (!username.trim()) {
      setError("Choose a username.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await activateInvite({
        token,
        username: username.trim(),
        password,
        confirmPassword,
      });
      if (response?.error || !response?.token) {
        setError(friendlyInviteError(response?.error || "Activation failed"));
        return;
      }

      await establishConsumerSession(response.token, setSession, response.user || response.profile || null);
      markOnboardingTourPending();
      router.replace("/onboarding");
    } catch (activationError: any) {
      setError(friendlyInviteError(activationError?.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] text-white">
      <div className="oyi-ambient-bg" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-5 py-[calc(18px+var(--sat))]">
        <header className="flex items-center justify-between">
          <Link href="/" className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/72 transition hover:bg-white/[0.07]" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/52">Secure resident activation</p>
          <div className="h-10 w-10" />
        </header>

        <section className="flex flex-1 flex-col justify-center py-8">
          <div className="text-center">
            <div className="oyi-orb mx-auto grid h-20 w-20 place-items-center rounded-full text-[18px] font-semibold tracking-[-0.08em]">Oyi</div>
            <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.06em]">Connect your home.</h1>
            <p className="mx-auto mt-2 max-w-[340px] text-sm leading-6 text-white/46">
              Validate the invitation from your estate, then create your private Oyi access.
            </p>
          </div>

          <div className="mt-7 rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            {!preview ? (
              <div className="space-y-3">
                {cameraMessage ? (
                  <div className="rounded-[18px] border border-amber-400/20 bg-amber-400/10 px-3.5 py-3 text-xs leading-5 text-amber-100/84">
                    <div className="flex items-center gap-2 font-semibold"><CameraOff className="h-4 w-4" /> Camera unavailable</div>
                    <p className="mt-1.5">{cameraMessage}</p>
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-sky-400/15 bg-sky-500/8 px-3.5 py-3 text-xs leading-5 text-sky-100/76">
                    <div className="flex items-center gap-2 font-semibold"><QrCode className="h-4 w-4" /> Invitation scanner</div>
                    <p className="mt-1.5">Scan the secure QR code from your estate team, or paste your setup link below.</p>
                  </div>
                )}

                <button type="button" onClick={() => void scanInvitation()} disabled={scanBusy || busy} className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-sky-300/18 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-100 transition disabled:opacity-45">
                  {scanBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {scanBusy ? "Opening camera…" : "Scan invitation QR"}
                </button>

                <label className="block">
                  <span className="text-xs font-medium text-white/62">Setup link or invite token</span>
                  <textarea
                    value={entry}
                    onChange={(event) => setEntry(event.target.value)}
                    rows={3}
                    placeholder="Paste your setup link"
                    className="mt-2 w-full resize-none rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/28 focus:border-sky-300/28"
                  />
                </label>
                <button type="button" onClick={() => void runValidation()} disabled={busy || !entry.trim()} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-45">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Validate invitation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[18px] border border-emerald-400/18 bg-emerald-400/8 px-3.5 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><CheckCircle2 className="h-4 w-4" /> Invitation verified</div>
                  <div className="mt-3 grid gap-2 text-xs text-white/58">
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-sky-200" /> {preview.estate.name}</div>
                    <div className="flex items-center gap-2"><Home className="h-3.5 w-3.5 text-sky-200" /> {preview.home.label}</div>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-sky-200" /> {preview.role}</div>
                    <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5 text-sky-200" /> Expires {formatExpiry(preview.expires_at)}</div>
                  </div>
                </div>

                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="Choose username" className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/28" />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Create password" className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/28" />
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Confirm password" className="w-full rounded-[18px] border border-white/[0.08] bg-black/24 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/28" />

                <button type="button" onClick={() => void activate()} disabled={busy || !username.trim() || !password || !confirmPassword} className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-45">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  Activate Oyi Home
                </button>
                <button type="button" onClick={() => setPreview(null)} className="w-full py-1 text-xs text-white/38 transition hover:text-white/62">Use a different invitation</button>
              </div>
            )}

            {error ? <div className="mt-3 rounded-[16px] border border-rose-400/20 bg-rose-400/10 px-3.5 py-3 text-xs leading-5 text-rose-100">{error}</div> : null}
          </div>
        </section>

        <p className="pb-[var(--sab)] text-center text-[11px] text-white/30">
          Already activated? <Link href="/auth/login" className="text-sky-200/76">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default function InviteActivationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#02060b]" />}>
      <InviteActivationClient />
    </Suspense>
  );
}
