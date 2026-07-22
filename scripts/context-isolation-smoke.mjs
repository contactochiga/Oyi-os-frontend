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
assertIncludes("src/app/components/remotes/WalletPanel.tsx", "walletService.getWallet(scope)", "wallet remote panel scoped wallet load");

assertIncludes("src/services/messagesService.ts", "scopeParams", "messages scoped params");
assertIncludes("src/app/messages/page.tsx", "messagesService.listInbox(scope)", "messages scoped inbox");
assertIncludes("src/app/messages/page.tsx", "unsubscribe:thread", "thread unsubscribe on cleanup");
assertIncludes("src/app/components/MessagesInboxButton.tsx", "useActiveContext", "message badge active context");

assertIncludes("src/services/maintenanceService.ts", "home_id: params.homeId", "maintenance maps homeId to home_id");
assertIncludes("src/app/components/remotes/MaintenancePanel.tsx", "useActiveContext", "maintenance remote panel uses active context");
assertIncludes("src/app/components/remotes/MaintenancePanel.tsx", "maintenanceService.listMyTickets({ estate_id: activeContext.estate_id, homeId: activeContext.home_id })", "maintenance remote panel loads selected-home tickets");
assertIncludes("src/app/components/remotes/MaintenancePanel.tsx", "setOpenModal(false)", "maintenance remote panel closes stale dialogs on context switch");
assertIncludes("src/app/home/page.tsx", "walletService.getWallet({ estate_id: estateId, home_id: homeId })", "home dashboard scoped wallet");
assertIncludes("src/app/home/page.tsx", "messagesService.listInbox({ estate_id: estateId, home_id: homeId })", "home dashboard scoped inbox");
assertIncludes("src/app/components/remotes/HomeSummaryPanel.tsx", "useActiveContext", "home summary panel uses active context");
assertIncludes("src/app/components/remotes/HomeSummaryPanel.tsx", "deviceService.getRuntimeDevices(activeContext.home_id)", "home summary panel counts selected-home runtime devices");
assertIncludes("src/app/components/remotes/HomeSummaryPanel.tsx", "maintenanceService.listMyTickets({ estate_id: activeContext.estate_id, homeId: activeContext.home_id })", "home summary panel counts selected-home maintenance");
assertIncludes("src/app/components/remotes/RoomsPanel.tsx", "useActiveContext", "rooms remote panel uses active context");
assertIncludes("src/app/components/remotes/RoomsPanel.tsx", "setOpenRoomId(null)", "rooms remote panel clears selected room on home changes");
assertIncludes("src/app/components/remotes/RoomsPanel.tsx", "contextKeyRef.current", "rooms remote panel rejects stale responses");
assertIncludes("src/app/components/remotes/MaintenancePanel.tsx", "contextKeyRef.current", "maintenance remote panel rejects stale responses");
assertIncludes("src/app/services/page.tsx", "estate_id: estateId", "services history estate scope");
assertIncludes("src/app/services/page.tsx", "Electricity purchase is temporarily unavailable. Your wallet has not been charged.", "electricity purchase failure is wallet-safe");
assertIncludes("src/app/services/page.tsx", "subtitle=\"Utility services for this home\"", "services header uses compact home utility copy");
assertIncludes("src/app/services/page.tsx", "identifier ? fullIdentifier(identifier)", "electricity card shows the configured meter number");
assertIncludes("src/app/services/page.tsx", "place-items-center", "electricity purchase dialog is centered in the viewport");
assertIncludes("src/app/services/page.tsx", "transaction_availability", "services page uses canonical transaction availability");
assertIncludes("src/app/services/page.tsx", "quoteElectricityPurchase", "electricity purchase starts with backend quote");
assertIncludes("src/app/services/page.tsx", "confirmElectricityPurchase", "electricity purchase confirms through backend purchase endpoint");
assertIncludes("src/app/services/page.tsx", "Confirm Purchase", "electricity purchase requires review before confirmation");
assertIncludes("src/app/services/page.tsx", "Test token", "test tokens are visibly labelled");
assertIncludes("src/services/servicesService.ts", "/services/electricity/quote", "electricity quote endpoint");
assertIncludes("src/services/servicesService.ts", "/services/electricity/purchase", "electricity purchase endpoint");
assertIncludes("src/services/notificationsService.ts", "home_id: scope?.home_id", "notification API requests include home scope");
assertIncludes("src/app/components/NotificationsBridge.tsx", "scope: activeContext.home_id ? \"home\" : \"account\"", "notification bridge defaults to current home");
assertIncludes("src/app/components/BottomNav.tsx", "VIEWPORT_RESIZE_GUARD_MS", "bottom nav ignores viewport resize scroll noise");
assertIncludes("src/app/components/GeoFenceBridge.tsx", "proximity_monitor_started", "proximity lifecycle diagnostics include monitor start");
assertIncludes("src/app/components/remotes/DoorPanel.tsx", "Unlock this door?", "door panel asks for unlock confirmation");

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
