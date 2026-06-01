"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CreditCard,
  DoorOpen,
  Home,
  Layers3,
  Lightbulb,
  MessagesSquare,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { completeOnboardingTour } from "@/services/onboardingTour";
import { useSessionStore } from "@/store/useSessionStore";

const TOUR_STEPS = [
  {
    title: "Welcome Home",
    body: "Your estate, home services, devices, security, and community now live here.",
    icon: Sparkles,
  },
  {
    title: "Meet Oyi",
    body: "Ask by voice or text. Oyi helps your home respond with care.",
    icon: Bot,
  },
  {
    title: "Your Home",
    body: "See the daily rhythm of your home, from security to visitors and messages.",
    icon: Home,
  },
  {
    title: "Spaces",
    body: "Move through rooms and discover the environments that make your home yours.",
    icon: Layers3,
  },
  {
    title: "Devices",
    body: "Connect Smart Life and control assigned devices safely.",
    icon: Lightbulb,
  },
  {
    title: "Visitors",
    body: "Welcome guests with a pass your estate security can verify.",
    icon: DoorOpen,
  },
  {
    title: "Wallet & Services",
    body: "Handle estate services and payments without leaving home.",
    icon: CreditCard,
  },
  {
    title: "Community",
    body: "Stay close to estate notices and the people around you.",
    icon: MessagesSquare,
  },
  {
    title: "Scenes & Automations",
    body: "Create moods and routines that let your home respond naturally.",
    icon: WandSparkles,
  },
  {
    title: "Ready",
    body: "Welcome to Oyi Home. Your living intelligence is ready when you are.",
    icon: Check,
  },
] as const;

export default function OnboardingTourPage() {
  const router = useRouter();
  const { token, hydrate } = useSessionStore();
  const [index, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate();
    setHydrated(true);
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !token) router.replace("/");
  }, [hydrated, router, token]);

  const step = TOUR_STEPS[index];
  const Icon = step.icon;
  const isLast = index === TOUR_STEPS.length - 1;

  function finish() {
    completeOnboardingTour();
    router.replace("/home");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02060b] text-white">
      <div className="oyi-ambient-bg" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[460px] flex-col px-5 py-[calc(18px+var(--sat))]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
            disabled={index === 0}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/70 transition disabled:opacity-0"
            aria-label="Previous tour step"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200/52">Getting started</p>
          <button type="button" onClick={finish} className="text-xs font-medium text-white/42 transition hover:text-white/70">
            Skip
          </button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-8">
          <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] px-5 py-8 text-center shadow-[0_28px_100px_rgba(0,0,0,0.56)] backdrop-blur-2xl">
            <div className="relative mx-auto h-28 w-28">
              <span className="absolute inset-[-14px] animate-pulse rounded-full bg-sky-500/10 blur-2xl" />
              <div className="oyi-orb relative grid h-28 w-28 place-items-center rounded-full">
                <Icon className="h-8 w-8 text-sky-100" />
              </div>
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-200/52">
              {index + 1} of {TOUR_STEPS.length}
            </p>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.065em]">{step.title}</h1>
            <p className="mx-auto mt-3 max-w-[330px] text-sm leading-6 text-white/52">{step.body}</p>

            <div className="mt-7 flex justify-center gap-1.5">
              {TOUR_STEPS.map((item, stepIndex) => (
                <span
                  key={item.title}
                  className={`h-1.5 rounded-full transition-all ${stepIndex === index ? "w-7 bg-sky-400" : "w-1.5 bg-white/16"}`}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="pb-[var(--sab)]">
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            {isLast ? "Finish" : "Next"}
            {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </main>
  );
}
