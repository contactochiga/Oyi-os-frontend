const INTERNAL_RSC_KEYS = [
  "_rsc",
  "__flight__",
  "__nextDataReq",
  "__nextLocale",
  "__nextDefaultLocale",
];

function safeUrl(value: string) {
  try {
    const origin = typeof window === "undefined" ? "https://consumer.local" : window.location.origin;
    return new URL(value, origin);
  } catch {
    return null;
  }
}

export function sanitizeNextHref(input: string | null | undefined, fallback = "/home") {
  const raw = String(input || "").trim();
  if (!raw) return fallback;
  const parsed = safeUrl(raw);
  if (!parsed) return fallback;
  if (typeof window !== "undefined" && parsed.origin !== window.location.origin) return fallback;
  if (typeof window === "undefined" && /^https?:\/\//i.test(raw) && parsed.origin !== "https://consumer.local") return fallback;
  INTERNAL_RSC_KEYS.forEach((key) => parsed.searchParams.delete(key));
  if (parsed.searchParams.has("next")) parsed.searchParams.delete("next");
  const href = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return href.startsWith("/") ? href : fallback;
}

export function currentUrlHasInternalRscParams() {
  if (typeof window === "undefined") return false;
  const url = safeUrl(window.location.href);
  if (!url) return false;
  return INTERNAL_RSC_KEYS.some((key) => url.searchParams.has(key));
}

export function cleanCurrentUrlOfInternalRscParams() {
  if (typeof window === "undefined") return null;
  const url = safeUrl(window.location.href);
  if (!url) return null;
  let changed = false;
  INTERNAL_RSC_KEYS.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (!changed) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
