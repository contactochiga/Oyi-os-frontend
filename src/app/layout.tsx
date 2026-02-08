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
      {/* ✅ match globals.css (height:100% + body locked) */}
      <body className="h-full overflow-hidden bg-black text-white">
        <ViewportKeyboardFix />
        <CapacitorBoot />

        <ReactQueryProvider>
          <AuthProvider>
            {/* ✅ ensures children can fill height consistently */}
            <div className="h-full">{children}</div>
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
