"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import useActiveContext from "@/hooks/useActiveContext";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function moduleFromPath(pathname: string) {
  const first = pathname.replace(/^\//, "").split("/")[0] || "home";
  if (first === "devices") return "device";
  if (first === "room" || first === "rooms") return "room";
  if (first === "scenes") return "scenes";
  if (first === "maintenance") return "maintenance";
  if (first === "wallet") return "wallet";
  if (first === "visitors") return "visitors";
  if (first === "services") return "services";
  if (first === "community") return "community";
  if (first === "security") return "security";
  return first;
}

function targetFor(module: string, search: URLSearchParams) {
  const map: Array<[string, string, string]> = [
    ["deviceId", "device", "deviceId"],
    ["channel", "device_channel", "channel"],
    ["roomId", "room", "roomId"],
    ["sceneId", "scene", "sceneId"],
    ["automationId", "automation", "automationId"],
    ["requestId", "maintenance_request", "ticketId"],
    ["ticketId", "maintenance_request", "ticketId"],
    ["transactionId", "transaction", "transactionId"],
    ["receipt", "transaction", "transactionId"],
    ["visitorId", "visitor", "visitorId"],
    ["serviceId", "service_account", "serviceId"],
    ["postId", "community_post", "postId"],
  ];
  for (const [param, type, outbound] of map) {
    const value = text(search.get(param));
    if (value) return { type, id: value, param: outbound };
  }
  if (module === "wallet") return { type: "wallet", id: "", param: "targetType" };
  if (module === "maintenance") return { type: "maintenance_request", id: "", param: "targetType" };
  if (module === "visitors") return { type: "visitor", id: "", param: "targetType" };
  if (module === "scenes") return { type: "scene", id: "", param: "targetType" };
  return { type: module || "home", id: "", param: "targetType" };
}

function starters(module: string) {
  if (module === "device") return ["Is this device working?", "Why is it unavailable?", "What changed recently?", "Is it used by a scene or automation?"];
  if (module === "scenes") return ["What will this do?", "Which devices will change?", "Why did the last run fail?"];
  if (module === "maintenance") return ["What happened?", "Who owns this?", "Is it overdue?"];
  if (module === "wallet") return ["Explain this transaction.", "Why did it fail?", "Show the receipt."];
  if (module === "visitors") return ["Can this person still enter?", "What is the current access state?"];
  if (module === "services") return ["Is this service active?", "What is the support path?"];
  if (module === "community") return ["What needs attention here?", "Summarize this update."];
  return ["What needs attention?", "What changed recently?", "What should I do next?"];
}

function ContextualOyiButtonInner({ label }: { label?: string }) {
  const pathname = usePathname() || "/home";
  const search = useSearchParams();
  const activeContext = useActiveContext();
  const activeModule = moduleFromPath(pathname);
  const target = targetFor(activeModule, search);
  const params = new URLSearchParams();
  params.set("module", activeModule);
  params.set("targetType", target.type);
  if (target.id) params.set(target.param, target.id);
  if (activeContext.home_id) params.set("homeId", activeContext.home_id);
  if (activeContext.estate_id) params.set("estateId", activeContext.estate_id);
  params.set("starter", starters(activeModule)[0]);
  const targetLabel = target.id ? target.id : activeContext.home?.name || "current context";
  return (
    <Link
      href={`/ai?${params.toString()}`}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.08] px-3 py-2 text-xs font-semibold text-cyan-50/90 shadow-[0_0_24px_rgba(80,220,255,0.08)] transition active:scale-[0.98]"
      aria-label={`Ask Oyi about ${targetLabel}`}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-100/80" />
      <span className="truncate">{label || `Ask Oyi about ${activeModule.replace(/_/g, " ")}`}</span>
    </Link>
  );
}

export default function ContextualOyiButton({ label }: { label?: string }) {
  return (
    <Suspense fallback={<span className="inline-flex h-9 w-24 rounded-full border border-cyan-200/10 bg-cyan-300/[0.05]" aria-hidden="true" />}>
      <ContextualOyiButtonInner label={label} />
    </Suspense>
  );
}
