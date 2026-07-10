import "./globals.css";
import ReactQueryProvider from "@/services/queryClient";
import { AuthProvider } from "@/hooks/useAuth";
import CapacitorBoot from "@/app/components/CapacitorBoot";
import ViewportKeyboardFix from "@/app/components/ViewportKeyboardFix";
import PushNotificationsBridge from "@/app/components/PushNotificationsBridge";
import NotificationsBridge from "@/app/components/NotificationsBridge";
import PresenceBridge from "@/app/components/PresenceBridge";
import GeoFenceBridge from "@/app/components/GeoFenceBridge";
import ContextIsolationBridge from "@/app/components/ContextIsolationBridge";
import RscNavigationGuard from "@/app/components/RscNavigationGuard";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Oyi OS",
  description: "Oyi Consumer OS for homes, devices, visitors, wallet activity and operational intelligence.",
  applicationName: "Oyi",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oyi",
  },
  icons: {
    icon: "/oyi-logo-transparent.png",
    apple: "/oyi-logo-transparent.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <ViewportKeyboardFix />
        <RscNavigationGuard />
        <CapacitorBoot />
        <ReactQueryProvider>
          <AuthProvider>
            <PushNotificationsBridge />
            <NotificationsBridge />
            <ContextIsolationBridge />
            <PresenceBridge />
            <GeoFenceBridge />
            {children}
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
