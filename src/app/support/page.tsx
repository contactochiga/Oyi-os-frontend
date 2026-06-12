"use client";

import ConsumerShell from "@/app/components/ConsumerShell";

export default function SupportPage() {
  return (
    <ConsumerShell title="Help & Support" subtitle="Guides, contact options, and resident help.">
      <div className="oyi-living-page space-y-3 pb-8">
        <section className="oyi-environment-hero rounded-[24px] p-4">
          <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Resident Support</div>
          <h1 className="mt-1.5 text-[18px] font-semibold tracking-[-0.04em] text-white">How can we help?</h1>
          <p className="mt-1.5 text-xs leading-5 text-white/50">Support options for your home, estate services, account, and connected devices will appear here as they become available.</p>
        </section>
        <section className="rounded-[22px] border border-white/[0.07] bg-white/[0.035] p-4 text-sm leading-6 text-white/58">
          For urgent security or estate operations issues, use Activity, Security, or Maintenance so the request stays linked to your active home context.
        </section>
      </div>
    </ConsumerShell>
  );
}
