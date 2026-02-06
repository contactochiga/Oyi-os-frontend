// src/app/auth/login/page.tsx
"use client";

import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white" />}>
      <LoginClient />
    </Suspense>
  );
}
