"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CloudSun,
  Droplets,
  Film,
  Home,
  Layers3,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Thermometer,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import API from "@/services/api";
import { completeOnboardingTour, isOnboardingTourComplete } from "@/services/onboardingTour";
import { useSessionStore } from "@/store/useSessionStore";

const TOUR_STEPS = [
  {
    title: "Welcome Home",
    body: ["Your estate, your services, your community — all in one intelligent experience."],
  },
  {
    title: "Meet Oyi",
    body: ["Ask by voice or text. Control by touch. Oyi handles the rest."],
  },
  {
    title: "Your Home, Connected",
    body: ["Monitor and manage what matters. Security, services, visitors, and daily living."],
  },
  {
    title: "Automate Your Lifestyle",
    body: ["Create scenes and automations that fit your life."],
  },
  {
    title: "You’re All Set",
    body: ["Everything is ready. Welcome to Oyi Home."],
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

function OyiOrb({ large = false }: { large?: boolean }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={reducedMotion ? undefined : { y: [0, -6, 0], scale: [1, 1.025, 1] }}
      transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      className={`relative grid place-items-center rounded-full border border-sky-300/55 bg-[radial-gradient(circle_at_38%_28%,rgba(255,255,255,0.42),rgba(0,123,255,0.28)_12%,rgba(0,56,142,0.38)_36%,rgba(1,8,22,0.98)_74%)] shadow-[0_0_48px_rgba(0,132,255,0.38)] ${large ? "h-28 w-28" : "h-[76px] w-[76px]"}`}
    >
      <span className="absolute inset-[-13px] rounded-full border border-sky-400/12" />
      <span className="absolute inset-[10px] rounded-full border border-white/10" />
      <span className={`${large ? "text-[28px]" : "text-[20px]"} font-semibold tracking-[-0.1em] text-white`}>Oyi</span>
    </motion.div>
  );
}

function HomeSilhouette({ complete = false }: { complete?: boolean }) {
  return (
    <div className="relative mx-auto h-[210px] w-full max-w-[310px]">
      <div className="absolute inset-x-4 bottom-3 h-[2px] bg-gradient-to-r from-transparent via-sky-400/44 to-transparent blur-[1px]" />
      <div className="absolute bottom-4 left-[16%] h-[116px] w-[68%] skew-x-[-8deg] border border-sky-300/28 bg-[linear-gradient(150deg,rgba(0,108,255,0.15),rgba(2,9,20,0.84))] shadow-[0_0_40px_rgba(0,110,255,0.16)]">
        <div className="grid h-full grid-cols-3 gap-2 p-3">
          {[0, 1, 2, 3, 4, 5].map((window) => (
            <span key={window} className={`border border-sky-200/18 ${complete || window % 2 === 0 ? "bg-sky-300/18 shadow-[0_0_14px_rgba(0,144,255,0.24)]" : "bg-white/[0.025]"}`} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-[120px] left-[14%] h-[2px] w-[73%] -rotate-[12deg] bg-sky-300/52 shadow-[0_0_12px_rgba(0,132,255,0.64)]" />
      <div className="absolute bottom-[13px] left-[8%] right-[8%] h-[46px] rounded-[50%] border-t border-sky-300/16 bg-sky-500/[0.035] blur-xl" />
    </div>
  );
}

function WelcomeVisual() {
  return (
    <div className="relative flex h-full flex-col items-center justify-end">
      <div className="absolute top-7 z-10"><OyiOrb /></div>
      <HomeSilhouette />
    </div>
  );
}

function MeetOyiVisual() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <div className="absolute left-3 top-10 rounded-[16px] border border-sky-300/22 bg-sky-500/10 px-3 py-2 text-[11px] leading-4 text-sky-100/86">
        Good evening.<br />How can I help?
      </div>
      <div className="relative">
        <div className="absolute left-1/2 top-1/2 h-[2px] w-[270px] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-sky-300/55 to-transparent" />
        <div className="absolute left-1/2 top-1/2 flex w-[260px] -translate-x-1/2 -translate-y-1/2 items-center justify-between">
          {[10, 20, 8, 26, 14, 32, 18, 24, 12, 28, 14, 22].map((height, index) => (
            <motion.span
              key={`${height}-${index}`}
              animate={{ height: [height * 0.5, height, height * 0.65] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.08 }}
              className="w-px rounded-full bg-sky-300/80"
            />
          ))}
        </div>
        <OyiOrb large />
      </div>
    </div>
  );
}

function ConnectedVisual() {
  const indicators = [
    [ShieldCheck, "Security"],
    [Thermometer, "Climate"],
    [Zap, "Energy"],
    [Droplets, "Water"],
  ] as const;
  return (
    <div className="relative h-full">
      <div className="absolute inset-x-0 bottom-0"><HomeSilhouette complete /></div>
      <div className="absolute inset-x-2 top-5 grid grid-cols-2 gap-x-20 gap-y-[104px]">
        {indicators.map(([Icon, label]) => (
          <div key={label} className="rounded-[14px] border border-sky-300/18 bg-[#06111d]/78 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="flex items-center gap-1.5 text-[10px] text-white/76"><Icon className="h-3.5 w-3.5 text-sky-300" />{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenesVisual({ onCreate }: { onCreate: () => void }) {
  const scenes = [
    [Sun, "Good Morning"],
    [Film, "Movie Night"],
    [Moon, "Sleep Mode"],
    [CloudSun, "Away Mode"],
  ] as const;
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-1">
      {scenes.map(([Icon, label], index) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 * index }}
          className="flex items-center gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.045] px-3 py-2.5 backdrop-blur-xl"
        >
          <Icon className="h-4 w-4 text-sky-300" />
          <span className="flex-1 text-xs font-medium text-white/84">{label}</span>
          <ArrowRight className="h-3.5 w-3.5 text-white/34" />
        </motion.div>
      ))}
      <button type="button" onClick={onCreate} className="mt-2 flex items-center justify-center gap-2 rounded-[16px] border border-sky-300/24 bg-sky-500/10 px-3 py-2.5 text-xs font-semibold text-sky-100">
        <Plus className="h-3.5 w-3.5" /> Create Your First Scene
      </button>
    </div>
  );
}

function CompleteVisual() {
  const nav = [
    [Home, "Home"],
    [Layers3, "Spaces"],
    [Users, "Community"],
    [WalletCards, "Wallet"],
  ] as const;
  return (
    <div className="relative flex h-full flex-col items-center justify-end">
      <div className="absolute top-4 z-10"><OyiOrb large /></div>
      <HomeSilhouette complete />
      <div className="absolute inset-x-4 bottom-0 flex justify-between rounded-[18px] border border-white/[0.07] bg-black/28 px-3 py-2 backdrop-blur-lg">
        {nav.map(([Icon, label]) => (
          <span key={label} className="grid justify-items-center gap-1 text-[8px] text-white/52"><Icon className="h-3.5 w-3.5 text-sky-300" />{label}</span>
        ))}
      </div>
    </div>
  );
}

function StepVisual({ index, onCreateScene }: { index: number; onCreateScene: () => void }) {
  if (index === 0) return <WelcomeVisual />;
  if (index === 1) return <MeetOyiVisual />;
  if (index === 2) return <ConnectedVisual />;
  if (index === 3) return <ScenesVisual onCreate={onCreateScene} />;
  return <CompleteVisual />;
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

  const step = TOUR_STEPS[index];
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
          <div className="mx-auto"><OyiOrb large /></div>
          <p className="mt-6 text-sm font-medium text-white/74">{gateError || "Preparing your Oyi Home"}</p>
          {gateError ? <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full border border-sky-300/24 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-100">Try again</button> : null}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] text-white">
      <motion.div animate={reducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.72, 1, 0.72] }} transition={{ duration: 9, repeat: Infinity }} className="oyi-ambient-bg" />
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
          <div className="w-full overflow-hidden rounded-[30px] border border-white/[0.09] bg-[linear-gradient(150deg,rgba(8,20,35,0.76),rgba(1,5,12,0.72))] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.title}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -18 }}
                transition={{ duration: 0.34, ease: "easeOut" }}
              >
                <div className="min-h-[122px]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-300/62">Oyi Home</p>
                  <h1 className="mt-3 max-w-[330px] text-[28px] font-semibold leading-[0.98] tracking-[-0.07em]">{step.title}</h1>
                  <p className="mt-4 max-w-[320px] text-sm leading-5 text-white/58">
                    {step.body.map((line, lineIndex) => <span key={`${line}-${lineIndex}`} className="block min-h-[10px]">{line}</span>)}
                  </p>
                </div>

                <div className="mt-3 h-[300px] overflow-hidden rounded-[22px] border border-sky-300/10 bg-[radial-gradient(circle_at_50%_48%,rgba(0,111,255,0.14),rgba(0,0,0,0.12)_52%,rgba(0,0,0,0.34))] px-3 py-3">
                  <StepVisual index={index} onCreateScene={() => router.push("/scenes?create=scene")} />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-5 flex justify-center gap-1.5">
              {TOUR_STEPS.map((item, stepIndex) => (
                <span key={item.title} className={`h-1.5 rounded-full transition-all duration-300 ${stepIndex === index ? "w-7 bg-sky-400" : "w-1.5 bg-white/16"}`} />
              ))}
            </div>

            <button
              type="button"
              onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(0,119,255,0.24)] transition active:scale-[0.99]"
            >
              {isLast ? "Let's Go Home" : "Continue"}
              {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
