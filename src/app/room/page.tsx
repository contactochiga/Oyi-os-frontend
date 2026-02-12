// src/app/room/page.tsx
import { Suspense } from "react";
import RoomClient from "./RoomClient";

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-white/60">Loading…</div>}>
      <RoomClient />
    </Suspense>
  );
}
