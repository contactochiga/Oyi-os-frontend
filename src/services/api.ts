import axios from "axios";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 12000,
});

API.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("ochiga_token") : null;
  if (token && config.headers) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

export default API;
