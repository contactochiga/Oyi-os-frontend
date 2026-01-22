"use client";

import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 text-white" />}>
      <SignupClient />
    </Suspense>
  );
}
