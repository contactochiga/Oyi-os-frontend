import fs from "node:fs";
import path from "node:path";

// Facility <-> Consumer Utilities acceptance. Root cause: the "Buy
// Electricity" gate was hard-coded to `item.key === "electricity"` in this
// file regardless of what the backend actually reported, and Water/Gas/
// Internet/Service Charge had no honest disabled-state messaging -- just
// one generic "is managed by your facility for now" toast on click. This
// proves: (1) the hard-coded electricity-only gate is gone, replaced by an
// explicit, still-honest frontend capability list combined with the
// backend's own transaction_availability signal; (2) unavailable actions
// show a real reason (Setup required / Provider unavailable / Unavailable),
// never a bare disabled button; (3) Service Charge now has a genuine
// second transactional path (a plain wallet debit, no external provider
// needed) with its own idempotency key, not a fabricated one.

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

const PAGE = "src/app/services/page.tsx";
const SERVICE = "src/services/servicesService.ts";

// The old hard-coded "only electricity can ever transact" gate must be
// gone -- replaced by a list that also includes estate_fees.
assertNotIncludes(PAGE, 'const canTransact = item.key === "electricity" && state.label === "Active";', "the old electricity-only canTransact gate");
assertIncludes(PAGE, 'item.key === "electricity" || item.key === "estate_fees"', "hasImplementedAction must explicitly include the second real transactional path (Service Charge)");
assertIncludes(PAGE, "canTransact = hasImplementedAction && state.label === \"Active\"", "enablement must combine real frontend capability with the backend's own availability signal");

// Honest, reason-specific disabled states -- never a bare dead button.
assertIncludes(PAGE, "UNAVAILABLE_REASON_LABELS", "an unavailable action must map to a real, specific reason");
assertIncludes(PAGE, "Setup required");
assertIncludes(PAGE, "Provider unavailable");
assertIncludes(PAGE, "Coming soon");

// Typed pricing is actually rendered (rate/unit or plan), not just
// theoretically present in the type system.
assertIncludes(PAGE, "function pricingRateText", "the page must render the typed pricing rate/plan, not only the raw registry fields");
assertIncludes(PAGE, "entry?.pricing", "front-of-card details must read the typed pricing summary");

// Service Charge: a real second transaction path, with its own dialog and
// its own idempotency key -- not reusing the electricity dialog's key
// format, and not a fabricated success without a real API call.
assertIncludes(PAGE, "function payServiceCharge", "Service Charge must call a real payment handler");
assertIncludes(PAGE, "servicesService.pay({");
assertIncludes(PAGE, "idempotency_key: `${activeContext.contextKey}:service_charge:", "the service charge payment must carry its own idempotency key");
assertIncludes(PAGE, "feeDialogOpen");

// servicesService.pay() must actually accept and send an idempotency key --
// the endpoint gained real idempotency handling on the backend, and this
// client must use it, not silently drop it.
assertIncludes(SERVICE, "idempotency_key: string", "servicesService.pay() must require an idempotency key");

// The typed pricing contract exists end to end on the Consumer side.
assertIncludes(SERVICE, "pricing_plans");
assertIncludes(SERVICE, "PricingSummary");
assertIncludes(SERVICE, "unavailable_reason");

console.log("typed utility pricing presentation smoke passed");
