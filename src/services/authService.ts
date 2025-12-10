import API from "./api";
import { supabase } from "./supabaseClient";

export async function signUpWithEmail(email: string, password: string, full_name?: string) {
  try {
    const res = await API.post("/auth/signup", { email, password, full_name });
    return res.data;
  } catch (err: any) {
    console.error("Signup error:", err);
    return { error: err?.response?.data?.message || "Signup failed" };
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const res = await API.post("/auth/login", { email, password });
    return res.data;
  } catch (err: any) {
    console.error("Login error:", err);
    return { error: err?.response?.data?.message || "Login failed" };
  }
}

// 🔥 Google OAuth login (redirect flow)
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/auth/callback" }
  });

  if (error) throw error;
  return data;
}

// 🔥 Apple OAuth
export async function signInWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: window.location.origin + "/auth/callback" }
  });

  if (error) throw error;
  return data;
}
