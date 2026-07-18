// src/services/authService.ts
import API from "./api";

/**
 * Backend returns:
 *  - success: { message, user, token }
 *  - error:   { error: string } OR { message: string }
 */

function pickError(err: any, fallback: string) {
  return (
    err?.userMessage ||
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

export async function requestPasswordReset(email: string) {
  try {
    const res = await API.post("/auth/password/forgot", { email });
    return res.data;
  } catch (err: any) {
    return { error: pickError(err, "We could not start password recovery right now.") };
  }
}

export async function verifyPasswordReset(email: string, code: string) {
  try {
    const res = await API.post("/auth/password/verify-reset", { email, code });
    return res.data;
  } catch (err: any) {
    return { error: pickError(err, "That reset code could not be verified.") };
  }
}

export async function completePasswordReset(input: { email: string; resetToken: string; password: string }) {
  try {
    const res = await API.post("/auth/password/reset", {
      email: input.email,
      resetToken: input.resetToken,
      password: input.password,
    });
    return res.data;
  } catch (err: any) {
    return { error: pickError(err, "We could not update your password.") };
  }
}

export type InvitePreview = {
  invite_id: string;
  estate: { id: string; name: string };
  home: { id: string; label: string };
  invited_email?: string | null;
  role: string;
  expires_at: string;
};

export type InviteActivationPayload = {
  token: string;
  username: string;
  password: string;
  confirmPassword: string;
};

export async function validateInvite(token: string) {
  try {
    const res = await API.post("/auth/invites/validate", { token });
    return res.data as { ok: true; preview: InvitePreview };
  } catch (err: any) {
    return { error: pickError(err, "This invitation could not be validated.") };
  }
}

export async function activateInvite(payload: InviteActivationPayload) {
  try {
    const res = await API.post("/auth/invites/activate", payload);
    return res.data;
  } catch (err: any) {
    return { error: pickError(err, "This invitation could not be activated.") };
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
