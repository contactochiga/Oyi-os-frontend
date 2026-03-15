// src/services/socket.ts
"use client";

import { io as createIO, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function getLS(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Get (or create) the singleton socket.
 * - attaches Authorization header from cookie token
 * - safe in browser only
 */
export function getSocket() {
  if (typeof window === "undefined") return null;

  const token =
    getLS("oyi_consumer_token_ls") ||
    getLS("oyi_consumer_token") ||
    getCookie("oyi_consumer_token");
  const baseURL = getBaseURL();

  // If socket exists but token changed, rebuild it cleanly
  const prevToken = (socket as any)?._ochigaToken as string | undefined;
  if (socket && prevToken !== token) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }

  if (!socket) {
    socket = createIO(baseURL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 600,

      /**
       * ✅ Important: pass JWT for your backend auth middleware
       * Socket.IO supports `auth` (recommended) and `extraHeaders` (websocket-only).
       */
      auth: token ? { token } : {},

      // optional: for polling phase in some envs
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    // store token for comparison
    (socket as any)._ochigaToken = token;
  }

  return socket;
}
