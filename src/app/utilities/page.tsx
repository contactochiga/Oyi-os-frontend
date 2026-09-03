"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy Consumer bookmark. Resident services now have one canonical surface. */
export default function UtilitiesPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/services"); }, [router]);
  return <main className="grid min-h-dvh place-items-center bg-[#03070c] px-6 text-center text-sm text-white/60">Opening Services…</main>;
}
