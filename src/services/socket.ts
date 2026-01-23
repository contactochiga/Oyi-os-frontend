// src/services/socket.ts
"use client";

import { io as createIO, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getBaseURL() {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return raw.replace(/\/$/, "");
}

export function getSocket() {
  if (typeof window === "undefined") return null;

  if (!socket) {
    socket = createIO(getBaseURL(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 600,
    });
  }

  return socket;
}
