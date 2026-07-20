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

console.log("context-isolation-smoke: ok");
