import fs from "node:fs";
import path from "node:path";

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

assertIncludes("src/services/api.ts", "X-Oyi-Estate-Id", "estate context header");
assertIncludes("src/services/api.ts", "X-Oyi-Home-Id", "home context header");
assertIncludes("src/services/api.ts", "X-Oyi-Context-Key", "context version header");

assertIncludes("src/services/walletService.ts", "scopeParams", "wallet scoped params");
assertIncludes("src/app/wallet/page.tsx", "useActiveContext", "wallet active context");
assertIncludes("src/app/wallet/page.tsx", "contextKeyRef", "wallet late-response guard");
assertIncludes("src/app/wallet/page.tsx", "walletService.getWallet(scope)", "wallet scoped load");
assertIncludes("src/app/wallet/page.tsx", "home_id: activeContext.home_id", "wallet funding home scope");

assertIncludes("src/services/messagesService.ts", "scopeParams", "messages scoped params");
assertIncludes("src/app/messages/page.tsx", "messagesService.listInbox(scope)", "messages scoped inbox");
assertIncludes("src/app/messages/page.tsx", "unsubscribe:thread", "thread unsubscribe on cleanup");
assertIncludes("src/app/components/MessagesInboxButton.tsx", "useActiveContext", "message badge active context");

assertIncludes("src/services/maintenanceService.ts", "home_id: params.homeId", "maintenance maps homeId to home_id");
assertIncludes("src/app/home/page.tsx", "walletService.getWallet({ estate_id: estateId, home_id: homeId })", "home dashboard scoped wallet");
assertIncludes("src/app/home/page.tsx", "messagesService.listInbox({ estate_id: estateId, home_id: homeId })", "home dashboard scoped inbox");
assertIncludes("src/app/services/page.tsx", "estate_id: estateId", "services history estate scope");
assertIncludes("src/app/services/page.tsx", "Electricity purchase is temporarily unavailable. Your wallet has not been charged.", "electricity purchase failure is wallet-safe");
assertIncludes("src/app/services/page.tsx", "Meter ${maskIdentifier(identifier)}", "compact provisioned meter display");
assertIncludes("src/app/services/page.tsx", "transaction_availability", "services page uses canonical transaction availability");
assertIncludes("src/app/services/page.tsx", "quoteElectricityPurchase", "electricity purchase starts with backend quote");
assertIncludes("src/app/services/page.tsx", "confirmElectricityPurchase", "electricity purchase confirms through backend purchase endpoint");
assertIncludes("src/app/services/page.tsx", "Review Purchase", "electricity purchase requires review before confirmation");
assertIncludes("src/app/services/page.tsx", "Test token", "test tokens are visibly labelled");
assertIncludes("src/services/servicesService.ts", "/services/electricity/quote", "electricity quote endpoint");
assertIncludes("src/services/servicesService.ts", "/services/electricity/purchase", "electricity purchase endpoint");

const servicesPage = read("src/app/services/page.tsx");
for (const forbidden of [
  "Electricity vending, backup continuity, and tariff readiness",
  "Provisioned by Facility",
  "Awaiting facility provisioning",
  "usage feed pending provider integration",
  "KCT / KCTN",
  "Provider readiness",
]) {
  if (servicesPage.includes(forbidden)) {
    throw new Error(`src/app/services/page.tsx still contains collapsed-card technical copy: ${forbidden}`);
  }
}

console.log("context-isolation-smoke: ok");
