import API, { setApiAuthToken } from "@/services/api";
import { decodeToken, isExpired, setCookie } from "@/lib/auth";
import type { SessionUser } from "@/store/useSessionStore";

function pickUserFromContext(payload: any) {
  return payload?.user || payload?.profile || payload?.me || payload?.resident || payload?.account || null;
}

export async function establishConsumerSession(
  token: string,
  setSession: (token: string, user?: SessionUser | null) => void,
  fallbackUser?: Partial<SessionUser> | null
) {
  const decoded = decodeToken(token);
  if (!decoded || isExpired(decoded)) throw new Error("Invalid session token");

  setCookie("oyi_consumer_token", token, 30);
  setApiAuthToken(token);
  setSession(token, { ...decoded, ...(fallbackUser || {}) } as SessionUser);

  try {
    const contextResponse = await API.get("/me/context");
    const payload = (contextResponse as any)?.data?.data ?? (contextResponse as any)?.data ?? null;
    const estate = payload?.estate ?? null;
    const home = payload?.home ?? null;
    const contextUser = pickUserFromContext(payload);

    const mergedUser = {
      ...(decoded || {}),
      ...(fallbackUser || {}),
      ...(contextUser || {}),
      id: contextUser?.id ?? fallbackUser?.id ?? decoded.id,
      email: contextUser?.email ?? fallbackUser?.email ?? decoded.email,
      role: contextUser?.role ?? fallbackUser?.role ?? decoded.role,
      estate_id: contextUser?.estate_id ?? estate?.id ?? payload?.estate_id ?? fallbackUser?.estate_id ?? decoded.estate_id,
      home_id: contextUser?.home_id ?? home?.id ?? payload?.home_id ?? fallbackUser?.home_id ?? decoded.home_id,
      onboarding_complete: payload?.onboarding_complete === true || contextUser?.onboarding_complete === true,
    } as SessionUser;

    setSession(token, mergedUser);

    if (typeof window !== "undefined") {
      if (estate?.id) localStorage.setItem("ochiga_estate", String(estate.id));
      if (home?.id) localStorage.setItem("ochiga_home", String(home.id));
    }

    return { user: mergedUser, context: payload };
  } catch {
    return { user: fallbackUser || decoded, context: null };
  }
}
