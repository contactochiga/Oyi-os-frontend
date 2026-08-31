import fs from "node:fs";
import path from "node:path";

// Production incident: a resident with 100% correct, active
// estate_memberships/home_memberships rows saw Community's "join an
// estate" message and a 403 on submitting a maintenance request, while
// Profile correctly showed both as connected. Root cause traced to
// Ochiga-backend's resolveOisContext silently swallowing a query error
// (fixed there) and, independently, this codebase reading a "highest
// priority" scope-override localStorage key (oyi_active_estate_id /
// oyi_active_home_id / oyi_active_context_key) that nothing here has
// ever written -- confirmed by a full grep of every localStorage.setItem
// call -- so it could only ever hold stale garbage from a since-removed
// code path, silently outranking the real, actively-synced keys. This
// smoke proves both are actually gone and never reintroduced.

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

function assertNotIncludes(file, needle, label = needle) {
  const body = read(file);
  if (body.includes(needle)) {
    throw new Error(`${file} must not contain ${label}`);
  }
}

// The dead, never-written, highest-priority scope keys must never again
// be READ in api.ts's active-scope resolution (an explanatory comment
// documenting the incident may still mention the names -- only the
// actual getLS(...) call sites matter here).
assertNotIncludes("src/services/api.ts", 'getLS("oyi_active_estate_id")', "the dead oyi_active_estate_id read");
assertNotIncludes("src/services/api.ts", 'getLS("oyi_active_home_id")', "the dead oyi_active_home_id read");
assertNotIncludes("src/services/api.ts", 'getLS("oyi_active_context_key")', "the dead oyi_active_context_key read");

// The real, actively-synced keys (written by useActiveContext.ts on every
// resolved context, and by sessionBootstrap.ts right after invite
// activation) must remain the actual source for the scope headers.
assertIncludes("src/services/api.ts", 'getLS("oyi_estate_id")', "the real, actively-synced estate id key");
assertIncludes("src/services/api.ts", 'getLS("oyi_home_id")', "the real, actively-synced home id key");

// logout() must defensively clear the dead keys too, so any browser that
// still has stale values from a since-removed code path is cleaned up
// the next time a session ends, not left to linger indefinitely.
assertIncludes("src/hooks/useAuth.tsx", "oyi_active_estate_id", "logout must clear the legacy dead estate scope key");
assertIncludes("src/hooks/useAuth.tsx", "oyi_active_home_id", "logout must clear the legacy dead home scope key");
assertIncludes("src/hooks/useAuth.tsx", "oyi_active_context_key", "logout must clear the legacy dead context key");

console.log("context membership source-of-truth smoke passed");
