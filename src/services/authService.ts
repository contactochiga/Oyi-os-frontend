import { supabase } from "./supabaseClient";

export async function signUpWithEmail(email: string, password: string, full_name?: string) {
  // We will call your backend /auth/signup to create a user so backend manages password hashing
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name }),
  });
  return res.json();
}

export async function loginWithEmail(email: string, password: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function signInWithGoogle() {
  // Use Supabase social sign-in which will redirect. For SPA flows, add a redirect URL in Supabase console.
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google" });
  if (error) throw error;
  return data;
}

// NOTE: Apple OAuth often requires you to configure provider on backend — if using Supabase, ensure Apple provider configured.
export async function signInWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "apple" as any });
  if (error) throw error;
  return data;
}
