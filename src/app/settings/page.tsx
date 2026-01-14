import { Suspense } from "react";
import LayoutWrapper from "../components/LayoutWrapper";
import SettingsClient from "./SettingsClient";

export default function SettingsPage() {
  return (
    <LayoutWrapper>
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsClient />
      </Suspense>
    </LayoutWrapper>
  );
}

function SettingsSkeleton() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="h-20 w-20 rounded-full bg-gray-800 mx-auto" />
      <div className="h-4 bg-gray-800 rounded w-1/3 mx-auto" />
      <div className="h-4 bg-gray-800 rounded w-1/2 mx-auto" />
    </main>
  );
}
