const PRODUCTION_BACKEND_URL = "https://oyi-os.onrender.com";
const LOCAL_BACKEND_URL = "http://localhost:5000";

export function getConsumerApiBaseURL() {
  const configured =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "";

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return LOCAL_BACKEND_URL;
    }
  }

  return PRODUCTION_BACKEND_URL;
}
