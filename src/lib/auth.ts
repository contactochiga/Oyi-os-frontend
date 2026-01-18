import { jwtDecode } from "jwt-decode";

export type DecodedToken = {
  id: string;
  email?: string;
  role?: string;
  estate_id?: string;
  home_id?: string;
  exp?: number;
};

export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwtDecode<DecodedToken>(token);
  } catch {
    return null;
  }
}

export function isExpired(decoded?: DecodedToken | null) {
  if (!decoded?.exp) return false;
  return Date.now() >= decoded.exp * 1000;
}

export function setCookie(name: string, value: string, days = 30) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function deleteCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}
