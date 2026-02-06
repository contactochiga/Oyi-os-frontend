import { Suspense } from "react";
import RoomsClient from "./RoomsClient";

export default function RoomsPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-white/60">Loading…</div>}
    >
      <RoomsClient />
    </Suspense>
  );
}
