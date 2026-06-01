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
    title: "Home",
    body: "See your home status, wallet, security, visitors, messages, and quick controls.",
    icon: Home,
  },
  {
    title: "Spaces",
    body: "Move through your rooms, view devices, scenes, and living environment.",
    icon: Layers3,
  },
  {
    title: "Devices",
    body: "Control assigned smart devices safely. New devices must be synced or assigned first.",
    icon: Lightbulb,
  },
  {
    title: "Visitors",
    body: "Create visitor passes. Security verifies the access code at the gate.",
    icon: DoorOpen,
  },
  {
    title: "Services & Wallet",
    body: "Pay service charges, utilities, estate services, and track history.",
    icon: CreditCard,
  },
  {
    title: "Scenes & Automations",
    body: "Create moods and routines for your home.",
    icon: WandSparkles,
  },
  {
    title: "Community",
    body: "Receive estate notices and communicate with your neighborhood.",
    icon: MessagesSquare,
  },
  {
    title: "Oyi AI",
    body: "Ask Oyi questions or run safe commands by voice or text.",
    icon: Bot,
  },
  {
    title: "You’re ready.",
    body: "Welcome home. Your living intelligence is ready when you are.",
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
          <div className="text-center">
            <div className="oyi-orb mx-auto grid h-24 w-24 place-items-center rounded-full">
              <Icon className="h-8 w-8 text-sky-100" />
            </div>
            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-200/52">
              {index + 1} of {TOUR_STEPS.length}
            </p>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.065em]">{step.title}</h1>
            <p className="mx-auto mt-3 max-w-[330px] text-sm leading-6 text-white/52">{step.body}</p>
          </div>

          <div className="mt-8 flex justify-center gap-1.5">
            {TOUR_STEPS.map((item, stepIndex) => (
              <span
                key={item.title}
                className={`h-1.5 rounded-full transition-all ${stepIndex === index ? "w-7 bg-sky-400" : "w-1.5 bg-white/16"}`}
              />
            ))}
          </div>
        </section>

        <div className="pb-[var(--sab)]">
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex((current) => current + 1))}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-sky-500 px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            {isLast ? "Enter Oyi Home" : "Continue"}
            {isLast ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </main>
  );
}
