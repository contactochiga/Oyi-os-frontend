import { io as makeIO, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;

  const url = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");
  socket = makeIO(url, { transports: ["websocket"], withCredentials: true });
  return socket;
}
