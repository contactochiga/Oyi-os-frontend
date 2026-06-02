"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HousePlug,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import API from "@/services/api";
import { completeOnboardingTour, isOnboardingTourComplete } from "@/services/onboardingTour";
import { useSessionStore } from "@/store/useSessionStore";

const TOUR_STEPS = [
  {
    eyebrow: "Welcome",
    title: "Welcome Home",
    body: "Your estate, services, and community now live in one intelligent experience.",
    icon: Sparkles,
  },
  {
    eyebrow: "Living intelligence",
    title: "Meet Oyi",
    body: "Ask by voice or text. Control by touch. Oyi helps you move faster.",
    icon: MessageCircle,
  },
  {
    eyebrow: "Everyday clarity",
    title: "Your Home",
    body: "See visitors, messages, security, wallet, maintenance, and daily status at a glance.",
    icon: ShieldCheck,
  },
  {
    eyebrow: "Make it yours",
    title: "Scenes & Devices",
    body: "Add devices, create scenes, and automate routines that fit your life.",
    icon: HousePlug,
  },
  {
    eyebrow: "Ready",
    title: "You’re Ready",
    body: "Everything is set. Welcome to Oyi Home.",
    icon: Check,
  },
] as const;

const PARTICLES = [
  ["12%", "18%", 0.7],
  ["78%", "14%", 1],
  ["88%", "44%", 0.65],
  ["18%", "72%", 0.85],
  ["62%", "78%", 0.6],
  ["46%", "26%", 0.7],
] as const;

function OyiOrb() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={reducedMotion ? undefined : { y: [0, -5, 0], scale: [1, 1.025, 1] }}
      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      className="relative grid h-28 w-28 place-items-center rounded-full border border-sky-300/55 bg-[radial-gradient(circle_at_38%_28%,rgba(255,255,255,0.42),rgba(0,123,255,0.28)_12%,rgba(0,56,142,0.38)_36%,rgba(1,8,22,0.98)_74%)] shadow-[0_0_52px_rgba(0,132,255,0.38)]"
    >
      <span className="absolute inset-[-14px] rounded-full border border-sky-400/12" />
      <span className="absolute inset-[10px] rounded-full border border-white/10" />
      <span className="text-[28px] font-semibold tracking-[-0.1em] text-white">Oyi</span>
    </motion.div>
  );
}

function TourCard({ index }: { index: number }) {
  const step = TOUR_STEPS[index];
  const Icon = step.icon;
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.085] bg-[linear-gradient(150deg,rgba(8,20,35,0.78),rgba(1,5,12,0.76))] px-5 py-6 shadow-[0_28px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 opacity-[0.11] [background-image:linear-gradient(rgba(125,211,252,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.24)_1px,transparent_1px)] [background-size:30px_30px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(0,132,255,0.24),transparent_70%)]" />

      <div className="relative flex min-h-[390px] flex-col items-center text-center">
        <div className="mt-6"><OyiOrb /></div>
        <div className="mt-8 grid h-10 w-10 place-items-center rounded-full border border-sky-300/18 bg-sky-400/10 text-sky-200">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-300/62">{step.eyebrow}</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.075em] text-white">{step.title}</h1>
        <p className="mx-auto mt-4 max-w-[310px] text-sm leading-6 text-white/58">{step.body}</p>
        {index === 3 ? (
          <div className="mt-6 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/62">
            <Moon className="h-3.5 w-3.5 text-sky-300" /> Scenes, devices, and routines
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function OnboardingTourPage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { token, hydrate } = useSessionStore();
  const [index, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      router.replace("/");
      return;
    }
    if (isOnboardingTourComplete()) {
      router.replace("/home");
      return;
    }

    let cancelled = false;
    void API.get("/me/context")
      .then((response) => {
        const payload = (response as any)?.data?.data ?? (response as any)?.data ?? {};
        if (cancelled) return;
        const onboardingComplete = payload?.onboarding_complete === true || payload?.user?.onboarding_complete === true;
        if (!onboardingComplete) {
          router.replace("/home");
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) setGateError("Oyi could not confirm your home setup. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, router, token]);

  const isLast = index === TOUR_STEPS.length - 1;

  function finish() {
    completeOnboardingTour();
    router.replace("/home");
  }

  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center overflow-hidden bg-[#02060b] px-6 text-white">
        <div className="oyi-ambient-bg" />
        <div className="relative text-center">
          <div className="mx-auto"><OyiOrb /></div>
          <p className="mt-6 text-sm font-medium text-white/74">{gateError || "Preparing your Oyi Home"}</p>
          {gateError ? <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full border border-sky-300/24 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-100">Try again</button> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] text-white">
      <motion.div animate={reducedMotion ? undefined : { scale: [1, 1.06, 1], opacity: [0.72, 1, 0.72] }} transition={{ duration: 9, repeat: Infinity }} className="oyi-ambient-bg" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_30%,rgba(0,112,255,0.16),transparent_38%),linear-gradient(180deg,rgba(1,8,18,0.28),rgba(0,0,0,0.76))]" />
      {PARTICLES.map(([left, top, opacity], particle) => (
        <motion.span
          key={`${left}-${top}`}
          animate={reducedMotion ? undefined : { opacity: [opacity * 0.35, opacity, opacity * 0.35], y: [0, -7, 0] }}
          transition={{ duration: 4 + particle * 0.4, repeat: Infinity, delay: particle * 0.25 }}
          className="pointer-events-none absolute h-1 w-1 rounded-full bg-sky-200"
          style={{ left, top, opacity }}
        />
      ))}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-5 pb-[calc(18px+var(--sab))] pt-[calc(18px+var(--sat))]">
        <header className="flex items-center justify-between">
          <p className="text-xs font-semibold tracking-[0.18em] text-sky-100/78">{index + 1} / {TOUR_STEPS.length}</p>
          <button type="button" onClick={finish} className="text-xs font-medium text-white/52 transition hover:text-white/82">Skip Tour</button>
        </header>

        <section className="flex flex-1 items-center py-5">
          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={TOUR_STEPS[index].title}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <TourCard index={index} />
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex justify-center gap-1.5">
              {TOUR_STEPS.map((item, stepIndex) => (
                <span key={item.title} className={`h-1.5 rounded-full transition-all duration-300 ${stepIndex === index ? "w-7 bg-sky-400" : "w-1.5 bg-white/16"}`} />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
              <button
                type="button"
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                disabled={index === 0}
                className="grid h-[50px] w-[50px] place-items-center rounded-[18px] border border-white/[0.08] bg-white/[0.035] text-white/68 transition disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.99]"
                aria-label="Previous tour card"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,119,255,0.24)] transition active:scale-[0.99]"
              >
                {isLast ? "Let's Go Home" : "Continue"}
                {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
