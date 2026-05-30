import { Suspense } from "react";
import RoomsClient from "../rooms/RoomsClient";

export default function SpacesPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-white/60">Loading...</div>}
    >
      <RoomsClient />
    </Suspense>
  );
}
