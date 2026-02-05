// src/app/layout.tsx
import "./globals.css";
import ReactQueryProvider from "@/services/queryClient";
import { AuthProvider } from "@/hooks/useAuth";

export const metadata = {
  title: "Oyi OS",
  description: "Oyi operating system — resident + estate management",
};

// ✅ Critical: makes iPhone render at device width (no zoomed-out desktop view)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
