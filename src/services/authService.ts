import API from "./api";

/**
 * Backend returns:
 *  - success: { message, user, token }
 *  - error:   { error: string }
 */

export async function signUpWithEmail(
  email: string,
  password: string,
  full_name?: string
) {
  try {
    const res = await API.post("/auth/signup", { email, password, full_name });
    return res.data;
  } catch (err: any) {
    console.error("Signup error:", err);
    return { error: err?.response?.data?.error || "Signup failed" };
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const res = await API.post("/auth/login", { email, password });
    return res.data;
  } catch (err: any) {
    console.error("Login error:", err);
    return { error: err?.response?.data?.error || "Login failed" };
  }
}

/**
 * ✅ For now, disable Supabase OAuth here so consumer auth stays same as facility.
 * We can re-enable later and exchange Supabase session -> backend JWT if you want.
 */
export async function signInWithGoogle() {
  return { error: "Google sign-in not enabled yet (backend JWT mode)." };
}

export async function signInWithApple() {
  return { error: "Apple sign-in not enabled yet (backend JWT mode)." };
}
