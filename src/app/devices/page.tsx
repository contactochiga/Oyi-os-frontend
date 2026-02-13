import { Suspense } from "react";
import DevicesClient from "./DevicesClient";

export default function DevicesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/60">Loading…</div>}>
      <DevicesClient />
    </Suspense>
  );
}
