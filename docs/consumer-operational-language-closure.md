## Consumer Operational Language Closure

### Audit findings

- The device drawer already had the canonical runtime payload, but it treated conversation as a temporary helper instead of a persistent device-scoped thread.
- `Show activity` and several suggestion chips bypassed the live response surface and jumped straight into tools or unrelated routes.
- The drawer cleared its own reply after a short timeout, which broke follow-up context and made Oyi fall back to broader device summaries.
- Consumer IR onboarding still showed generic profile choices when the provider had not exposed exact configured remotes.
- Consumer services still presented electricity, generator recovery, solar, facility fees, and estate fees as separate resident-facing cards instead of one cleaner resident taxonomy.
- Native login errors were being surfaced as a generic `Network Error`, and Capacitor localhost could resolve to the wrong backend base URL.

### Closure rules applied

- Device drawer requests now carry the selected device identity and enriched runtime context into the canonical `/oyi/chat` path.
- Device-scoped conversations are restored from canonical Oyi threads when the same drawer is reopened.
- Drawer replies persist until the user closes the drawer, switches device, or sends another request.
- Activity and relationship requests answer inside the drawer first, with optional deeper follow-up actions.
- Consumer IR onboarding now only exposes provider-backed appliance profiles. If the provider does not expose configured remotes, Oyi says so directly.
- Resident services are consolidated to:
  - Power
  - Water
  - Internet
  - Gas
  - Estate Fees
- Native networking now prefers the production backend for Capacitor localhost shells and logs request diagnostics with runtime/environment metadata.

### Remaining honest provider limitation

- Exact Smart Life remote import depends on the current Tuya project exposing configured IR appliance profiles for the connected hub. Oyi now avoids inventing unsupported children when that provider data is absent.
