import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ochiga.oyios",
  appName: "Oyi",
  webDir: "out",          // ✅ IMPORTANT: Next static export output
  bundledWebRuntime: false,
};

export default config;
