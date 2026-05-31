// src/services/authService.ts
import API from "./api";

/**
 * Backend returns:
 *  - success: { message, user, token }
 *  - error:   { error: string } OR { message: string }
 */

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||      // ✅ your backend format
    err?.response?.data?.message ||    // (some endpoints may use message)
    err?.message ||
    fallback
  );
}

// ✅ UPDATED: otpToken is required for OTP-gated signup
export async function signUpWithEmail(
  email: string,
  password: string,
  full_name?: string,
  otpToken?: string
) {
  try {
    const res = await API.post(
      "/auth/signup",
      {
        email,
        password,
        full_name,
        otpToken, // ✅ body fallback
      },
      {
        headers: otpToken ? { "x-otp-token": otpToken } : undefined, // ✅ main gate header
      }
    );

    return res.data;
  } catch (err: any) {
    console.error("Signup error:", err);
    return { error: pickError(err, "Signup failed") };
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const res = await API.post("/auth/login", { email, password });
    return res.data;
  } catch (err: any) {
    console.error("Login error:", err);
    return { error: pickError(err, "Login failed") };
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

export async function updateMyProfile(payload: {
  username?: string;
  full_name?: string;
  phone?: string;
}) {
  try {
    const res = await API.patch("/me/profile", payload);
    return res.data;
  } catch (err: any) {
    console.error("Update profile error:", err);
    return { error: pickError(err, "Failed to update profile") };
  }
}

export async function deleteMyAccount() {
  try {
    const res = await API.delete("/me/account");
    return res.data;
  } catch (err: any) {
    console.error("Delete account error:", err);
    return { error: pickError(err, "Failed to delete account") };
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read profile image"));
    reader.readAsDataURL(file);
  });
}

export async function uploadMyProfileImage(file: File) {
  try {
    const base64 = await fileToDataUrl(file);
    const res = await API.post("/me/profile/avatar", {
      base64,
      mime: file.type || "image/jpeg",
      filename: file.name || "avatar.jpg",
    });
    return res.data;
  } catch (err: any) {
    const status = Number(err?.response?.status || 0);
    if (status === 404 || status === 405) {
      return { error: "Profile image upload is not configured yet", configured: false };
    }
    console.error("Upload profile image error:", err);
    return { error: pickError(err, "Failed to upload profile image"), configured: status !== 404 };
  }
}

export async function removeMyProfileImage() {
  try {
    const res = await API.delete("/me/profile/avatar");
    return res.data;
  } catch (err: any) {
    const status = Number(err?.response?.status || 0);
    if (status === 404 || status === 405) {
      return { error: "Profile image removal is not configured yet", configured: false };
    }
    console.error("Remove profile image error:", err);
    return { error: pickError(err, "Failed to remove profile image"), configured: status !== 404 };
  }
}
