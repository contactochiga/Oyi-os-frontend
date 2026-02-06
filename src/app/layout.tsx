import "./globals.css";
import ReactQueryProvider from "@/services/queryClient";
import { AuthProvider } from "@/hooks/useAuth";
import CapacitorBoot from "@/app/components/CapacitorBoot";
import ViewportKeyboardFix from "@/app/components/ViewportKeyboardFix";

export const metadata = {
  title: "Oyi OS",
  description: "Oyi operating system — resident + estate management",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        {/* ✅ must run once globally */}
        <ViewportKeyboardFix />

        <CapacitorBoot />
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
