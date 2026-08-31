import fs from "node:fs";
import path from "node:path";

// Security fix -- Ochiga-backend's activate_resident_invite() previously
// unconditionally overwrote username/password_hash on every activation.
// This repo's invite page always called activateInvite() (the new-
// identity path), even for an existing Oyi identity accepting an
// additional Home invitation -- meaning invitation possession alone could
// silently replace a real account's credentials. Paired with the backend
// fix (Ochiga-backend fix/resident-invite-existing-identity-credentials,
// which adds a p_existing_user_id RPC path that never touches
// username/password_hash), this repo now offers an existing-identity
// "Accept as <email>" path when a valid session is already present, and a
// "Sign in first" link (preserving the invite token through
// /auth/login?next=...) when it isn't -- mirroring the pattern
// facility-oyi's estate-owner invite page already established. This
// smoke proves the wiring stays in place.

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertIncludes(file, needle, label = needle) {
  const body = read(file);
  if (!body.includes(needle)) {
    throw new Error(`${file} is missing ${label}`);
  }
}

const AUTH_SERVICE = "src/services/authService.ts";
assertIncludes(AUTH_SERVICE, "export async function acceptInvite", "the existing-identity acceptInvite() export");
assertIncludes(AUTH_SERVICE, '"/auth/invites/accept"', "acceptInvite must call the existing-identity backend route");
assertIncludes(AUTH_SERVICE, "headers: { authorization: `Bearer ${sessionToken}` }", "acceptInvite must send the caller's own session token, not credentials");

const INVITE_PAGE = "src/app/auth/invite/page.tsx";
assertIncludes(INVITE_PAGE, "acceptInvite", "the invite page must import/use acceptInvite for the existing-identity path");
assertIncludes(INVITE_PAGE, "hasActiveSession", "the invite page must detect an already-active session before defaulting to the new-identity form");
assertIncludes(INVITE_PAGE, "acceptAsCurrentUser", "the invite page must expose an existing-identity acceptance handler");
assertIncludes(INVITE_PAGE, "Accept as {session.user?.email}", "the invite page must offer to accept the invite as the currently signed-in identity");
assertIncludes(INVITE_PAGE, "Not you? Use a different account", "the invite page must let the resident opt out of the detected session");
assertIncludes(INVITE_PAGE, "/auth/login?next=", "the invite page must offer a sign-in-first path that preserves the invite token through login");

console.log("resident invite existing-identity smoke passed");
