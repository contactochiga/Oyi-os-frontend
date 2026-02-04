// src/app/settings/page.tsx
import { Suspense } from "react";
import SettingsClient from "./SettingsClient";
import ConsumerShell from "@/app/components/ConsumerShell";

export default function SettingsPage() {
  return (
    <ConsumerShell title="Account" subtitle="Profile • Preferences • System">
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsClient />
      </Suspense>
    </ConsumerShell>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="h-20 w-20 rounded-full bg-gray-800 mx-auto" />
      <div className="h-4 bg-gray-800 rounded w-1/3 mx-auto" />
      <div className="h-4 bg-gray-800 rounded w-1/2 mx-auto" />

      <div className="space-y-3 pt-6">
        <div className="h-12 bg-gray-900 border border-gray-800 rounded-xl" />
        <div className="h-12 bg-gray-900 border border-gray-800 rounded-xl" />
        <div className="h-12 bg-gray-900 border border-gray-800 rounded-xl" />
      </div>
    </div>
  );
}
