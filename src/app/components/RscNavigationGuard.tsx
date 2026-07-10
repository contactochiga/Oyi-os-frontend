"use client";

import { useEffect } from "react";
import { cleanCurrentUrlOfInternalRscParams, currentUrlHasInternalRscParams } from "@/lib/navigationSafety";

const RELOAD_GUARD_KEY = "oyi:rsc-clean-reloaded";

export default function RscNavigationGuard() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentUrlHasInternalRscParams()) return;
    const cleaned = cleanCurrentUrlOfInternalRscParams();
    if (!cleaned) return;

    const last = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
    if (last === cleaned) {
      window.history.replaceState(null, "", cleaned);
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return;
    }

    window.sessionStorage.setItem(RELOAD_GUARD_KEY, cleaned);
    window.location.replace(cleaned);
  }, []);

  return null;
}
