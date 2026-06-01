export function extractInviteToken(input: string) {
  const value = String(input || "").trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    const queryToken = url.searchParams.get("token");
    if (queryToken) return queryToken.trim();

    const pathMatch = url.pathname.match(/\/invite\/([^/?#]+)/i);
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]).trim();
  } catch {
    const queryMatch = value.match(/[?&]token=([^&#]+)/i);
    if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]).trim();

    const schemeMatch = value.match(/^oyi:\/\/invite\/([^/?#]+)/i);
    if (schemeMatch?.[1]) return decodeURIComponent(schemeMatch[1]).trim();
  }

  return value;
}
