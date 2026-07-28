"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BatteryCharging, Check, ChevronDown, ChevronRight, Clock3, Film, Home, Lock, Moon, Pencil, Plane, Plus, ShieldCheck, Sparkles, SunMedium, Trash2, X, Zap } from "lucide-react";

import BottomNav from "@/app/components/BottomNav";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import LayoutWrapper from "@/app/components/LayoutWrapper";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import useAuth from "@/hooks/useAuth";
import useActiveContext from "@/hooks/useActiveContext";
import { normalizeRuntimeContract } from "@/lib/deviceRuntimeContract";
import { deviceService } from "@/services/deviceService";
import { sceneService, type ConsumerAutomation, type ConsumerScene, type SceneAction, type SceneRunResult } from "@/services/sceneService";

type Tab = "scenes" | "automations";
type AnyDevice = Record<string, any>;
type SceneTemplate = { name: string; icon: any; description: string; power: "on" | "off"; trigger?: string };
type ActionOption = { code: string; label: string; valueType: "boolean" | "number" | "string" };
type ActionSupport = { supported: boolean; disabledReason?: string; options: ActionOption[] };
type ActionSelection = { device_id: string; command_code: string; value: boolean; label: string };
type ScenePresentation =
  | { mode: "list" }
  | { mode: "editor"; tab: Tab; scene?: ConsumerScene | ConsumerAutomation | null; template?: SceneTemplate | null; initialDeviceId?: string; error?: string }
  | { mode: "saving"; tab: Tab; sceneId?: string }
  | { mode: "running"; sceneId: string }
  | { mode: "result"; sceneId: string; result: SceneRunResult; canRunAgain?: ConsumerScene };

const SCENE_TEMPLATES: SceneTemplate[] = [
  { name: "Good Morning", icon: SunMedium, description: "Wake the home gently with selected lights and devices.", power: "on" },
  { name: "Good Night", icon: Moon, description: "Quiet selected devices before sleep.", power: "off" },
  { name: "Leaving Home", icon: Lock, description: "Turn selected devices off as you step out.", power: "off" },
  { name: "Welcome Home", icon: Home, description: "Bring selected devices back on when you return.", power: "on" },
  { name: "Movie Time", icon: Film, description: "Prepare selected lights or media devices for a calm evening.", power: "on" },
  { name: "Relax", icon: Sparkles, description: "Set selected devices into a softer home mood.", power: "on" },
  { name: "Away Mode", icon: ShieldCheck, description: "Reduce selected devices while the home is empty.", power: "off" },
  { name: "Energy Saver", icon: BatteryCharging, description: "Switch selected non-essential devices off.", power: "off" },
  { name: "Vacation Mode", icon: Plane, description: "Prepare selected devices for an extended absence.", power: "off" },
  { name: "Security Lockdown", icon: ShieldCheck, description: "Group supported safety devices into one manual scene.", power: "on" },
];

function text(...values: any[]) {
  for (const value of values) {
    const next = String(value ?? "").trim();
    if (next) return next;
  }
  return "";
}

function titleCase(value: string, fallback = "Device") {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.split(/\s+/).map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1)).join(" ");
}

function deviceId(device: AnyDevice) {
  return text(device?.deviceId, device?.device_id, device?.id);
}

function deviceName(device: AnyDevice) {
  return text(device?.name, device?.device_name, device?.display_name, device?.label, device?.alias, device?.metadata?.name, device?.metadata?.display_name, "Device");
}

function roomName(device: AnyDevice) {
  const contract = normalizeRuntimeContract(device, device);
  return text(contract.presentation?.assignment?.roomName, contract.canonical_presentation?.assignment?.roomName, device?.room_name, device?.room?.name, device?.metadata?.room_name, "Unassigned");
}

function deviceFamily(device: AnyDevice) {
  const contract = normalizeRuntimeContract(device, device);
  const haystack = [
    contract.device_family,
    contract.control_profile,
    contract.device_type,
    device?.category,
    device?.type,
    device?.metadata?.raw?.category,
    device?.metadata?.product_name,
    deviceName(device),
  ].map((item) => String(item || "").toLowerCase()).join(" ");
  if (/\b(jtmspro|lock|doorlock|smart_access)\b/.test(haystack)) return "lock";
  if (/\b(tv|television|infrared|ir remote|ir_remote)\b/.test(haystack)) return "ir";
  if (/\b(curtain)\b/.test(haystack)) return "curtain";
  if (/\b(climate|air_conditioner|ac)\b/.test(haystack)) return "climate";
  if (/\b(switch|plug|socket|light)\b/.test(haystack)) return "switch";
  const codes = new Set([...(contract.capability_codes || []), ...(contract.supported_controls || [])].map((item) => String(item).toLowerCase()));
  if (Array.from(codes).some((code) => /^switch(_\d+)?$/.test(code) || ["power", "on"].includes(code))) return "switch";
  return "unknown";
}

function sceneActionOptions(device: AnyDevice): ActionSupport {
  const contract = normalizeRuntimeContract(device, device);
  const family = deviceFamily(device);
  if (family === "lock") return { supported: false, options: [], disabledReason: "Lock actions are unavailable in scenes for safety." };
  if (family === "ir") return { supported: false, options: [], disabledReason: "TV and IR remote actions are not enabled for scenes in this phase." };

  const codes = new Set([...(contract.capability_codes || []), ...(contract.supported_controls || [])].map((item) => String(item).toLowerCase()));
  if (family === "switch") {
    const channels = (Array.isArray(contract.channel_definitions) ? contract.channel_definitions : [])
      .filter((channel) => channel?.controllable !== false && channel?.code)
      .map((channel, index) => ({
        code: String(channel.code),
        label: text(channel.name, `Channel ${Number(channel.index || index + 1)}`),
        valueType: "boolean" as const,
      }));
    if (channels.length) return { supported: true, options: channels };
    const switchCodes = Array.from(codes)
      .filter((code) => /^switch_\d+$/.test(code))
      .sort((a, b) => Number(a.split("_")[1] || 0) - Number(b.split("_")[1] || 0))
      .map((code) => ({ code, label: titleCase(code, "Switch"), valueType: "boolean" as const }));
    if (switchCodes.length) return { supported: true, options: switchCodes };
    if (["switch", "power", "on"].some((code) => codes.has(code))) return { supported: true, options: [{ code: codes.has("switch") ? "switch" : codes.has("power") ? "power" : "on", label: "Power", valueType: "boolean" }] };
  }

  if (family === "curtain") {
    const options = ["open", "close", "position"].filter((code) => codes.has(code)).map((code) => ({ code, label: titleCase(code), valueType: code === "position" ? "number" as const : "boolean" as const }));
    if (options.length) return { supported: true, options };
  }

  if (family === "climate") {
    const options = ["temperature", "temp_set", "mode"].filter((code) => codes.has(code)).map((code) => ({ code, label: titleCase(code), valueType: code === "mode" ? "string" as const : "number" as const }));
    if (options.length) return { supported: true, options };
  }

  return { supported: false, options: [], disabledReason: "Scene actions are not available for this device yet." };
}

function commandEntries(command: Record<string, any> | undefined) {
  return Object.entries(command || {}).filter(([key]) => !["source", "metadata", "meta", "idempotency_key", "command_key"].includes(String(key).toLowerCase()));
}

function selectionKey(deviceIdValue: string, commandCode: string) {
  return `${deviceIdValue}:${commandCode}`;
}

function describeAction(action: SceneAction) {
  const [code, value] = commandEntries(action.command)[0] || ["switch", true];
  return action.action_label || action.label || `${titleCase(String(code), "Power")} -> ${value ? "On" : "Off"}`;
}

function statusCopy(status: string) {
  if (status === "completed") return "Completed";
  if (status === "partially_completed") return "Partially completed";
  if (status === "pending_confirmation") return "Pending confirmation";
  if (status === "accepted") return "Sent";
  if (status === "denied") return "Denied";
  if (status === "timed_out") return "Timed out";
  if (status === "failed") return "Failed";
  return titleCase(status, "Unknown");
}

function syntheticRunResult(scene: ConsumerScene, status: string, message: string): SceneRunResult {
  return {
    ok: false,
    scene_run_id: `client:${Date.now()}`,
    scene_id: scene.id,
    scene_name: scene.name,
    status,
    requested_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    counts: { total: scene.actions?.length || 1, completed: 0, failed: scene.actions?.length || 1 },
    actions: [{
      device_id: null,
      device_name: "Scene",
      action_label: message,
      status: "failed",
      command_execution_id: null,
    }],
  };
}

function normalizeRunResult(scene: ConsumerScene, payload: any, fallbackStatus = "failed", fallbackMessage = "The scene could not be completed."): SceneRunResult {
  if (payload?.scene_run_id) {
    return {
      ok: payload.ok,
      scene_run_id: String(payload.scene_run_id),
      scene_id: String(payload.scene_id || scene.id),
      scene_name: String(payload.scene_name || scene.name),
      status: String(payload.status || fallbackStatus),
      requested_at: String(payload.requested_at || new Date().toISOString()),
      completed_at: payload.completed_at || new Date().toISOString(),
      counts: payload.counts || { total: Array.isArray(payload.actions) ? payload.actions.length : 1, completed: 0, failed: 1 },
      actions: Array.isArray(payload.actions) ? payload.actions : syntheticRunResult(scene, fallbackStatus, fallbackMessage).actions,
    };
  }
  return syntheticRunResult(scene, fallbackStatus, fallbackMessage);
}

function useSceneSurfaceLifecycle(active: boolean, onBack: () => void) {
  const backArmed = useRef(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const previousPointerEvents = document.body.style.pointerEvents;
    if (active) {
      document.body.style.overflow = "hidden";
      document.body.style.pointerEvents = "";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.pointerEvents = previousPointerEvents;
    };
  }, [active]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    if (!backArmed.current) {
      window.history.pushState({ oyiSceneSurface: true }, "", window.location.href);
      backArmed.current = true;
    }
    const handlePop = () => {
      backArmed.current = false;
      onBack();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("popstate", handlePop);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("keydown", handleKey);
      backArmed.current = false;
    };
  }, [active, onBack]);
}

export default function ScenesPage() {
  useAuth();
  const activeContext = useActiveContext();
  const estateId = activeContext.estate_id || "";
  const homeId = activeContext.home_id || "";
  const contextReady = activeContext.ready;
  const [tab, setTab] = useState<Tab>("scenes");
  const [scenes, setScenes] = useState<ConsumerScene[]>([]);
  const [automations, setAutomations] = useState<ConsumerAutomation[]>([]);
  const [devices, setDevices] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [presentation, setPresentation] = useState<ScenePresentation>({ mode: "list" });
  const [deletingItem, setDeletingItem] = useState<ConsumerScene | ConsumerAutomation | null>(null);

  async function refresh() {
    if (!contextReady || !estateId) {
      setScenes([]);
      setAutomations([]);
      setDevices([]);
      setLoading(activeContext.loading || activeContext.switching);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [nextScenes, nextAutomations, nextDevices] = await Promise.all([
        sceneService.listScenes(),
        sceneService.listAutomations(),
        deviceService.getRuntimeDevices(homeId),
      ]);
      setScenes(nextScenes);
      setAutomations(nextAutomations);
      setDevices(nextDevices);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Unable to load scenes right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    if (requestedTab === "automations") setTab("automations");
    if (requestedTab === "scenes") setTab("scenes");
    if (params.get("create") === "scene") {
      setTab("scenes");
      setPresentation({ mode: "editor", tab: "scenes", scene: null, template: null, initialDeviceId: params.get("deviceId") || "" });
    }
  }, []);

  useEffect(() => { void refresh(); }, [contextReady, activeContext.contextKey]);

  const returnToList = useCallback(() => {
    setPresentation({ mode: "list" });
    setDeletingItem(null);
  }, []);

  async function runScene(scene: ConsumerScene) {
    if (presentation.mode === "running" && presentation.sceneId === scene.id) return;
    setPresentation({ mode: "running", sceneId: scene.id });
    setError("");
    try {
      const result = await sceneService.runScene(scene.id, scene.name);
      await refresh();
      setPresentation({ mode: "result", sceneId: scene.id, result, canRunAgain: scene });
    } catch (err: any) {
      const payload = err?.response?.data;
      const message = payload?.error || err?.message || "Scene could not complete.";
      const result = normalizeRunResult(scene, payload, payload?.scene_run_id ? String(payload.status || "failed") : "failed", message);
      setPresentation({ mode: "result", sceneId: scene.id, result, canRunAgain: scene });
    }
  }

  async function toggleAutomation(automation: ConsumerAutomation) {
    setError("");
    try {
      await sceneService.updateAutomation(automation.id, { enabled: !automation.enabled });
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Automation could not update.");
    }
  }

  async function deleteItem(item: ConsumerScene | ConsumerAutomation) {
    setError("");
    try {
      if (tab === "scenes") await sceneService.deleteScene(item.id);
      else await sceneService.deleteAutomation(item.id);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Could not delete item.");
    } finally {
      setDeletingItem(null);
    }
  }

  const surfaceActive = presentation.mode !== "list" || Boolean(deletingItem);
  useSceneSurfaceLifecycle(surfaceActive, returnToList);

  const items = tab === "scenes" ? scenes : automations;
  const configuredSceneNames = useMemo(() => new Set(scenes.map((scene) => scene.name.trim().toLowerCase())), [scenes]);
  const sceneBlueprints = useMemo(() => SCENE_TEMPLATES.filter((template) => !configuredSceneNames.has(template.name.toLowerCase())), [configuredSceneNames]);

  return (
    <LayoutWrapper>
      <main className="fixed inset-0 overflow-hidden bg-[#02060b] text-white">
        <div className="oyi-ambient-bg" />
        <div className="fixed inset-x-0 z-[80] px-5" style={{ top: "calc(8px + var(--sat))" }}>
          <div className="mx-auto flex max-w-[430px] items-center justify-between">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.03] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><HamburgerMenu /></div>
            <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.028] shadow-[0_8px_26px_rgba(0,0,0,0.28)] backdrop-blur-2xl"><MessagesInboxButton /></div>
          </div>
        </div>
        <div className="relative z-10 h-full overflow-y-auto px-5 pb-[calc(104px+var(--sab))]" style={{ paddingTop: "calc(70px + var(--sat))" }}>
          <div className="mx-auto max-w-[430px]">
            <header>
              <h1 className="text-[29px] font-semibold leading-none tracking-[-0.05em]">Scenes</h1>
              <p className="mt-2 max-w-[330px] text-[13px] leading-5 text-white/52">Run safe, home-scoped device actions together without opening every device.</p>
            </header>
            <div className="mt-5 flex gap-2">
              {(["scenes", "automations"] as Tab[]).map((key) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full border px-3.5 py-2 text-xs font-medium capitalize ${tab === key ? "border-sky-300/55 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.025] text-white/52"}`}>{key}</button>
              ))}
            </div>
            <section className="mt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em]">{tab === "scenes" ? "Scene dashboard" : "Automations"}</h2>
                <button type="button" onClick={() => setPresentation({ mode: "editor", tab, scene: null, template: null })} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs text-sky-100"><Plus className="h-3.5 w-3.5" /> Create {tab === "scenes" ? "scene" : "automation"}</button>
              </div>
              {error ? <p className="mt-3 rounded-[18px] border border-red-300/14 bg-red-500/[0.06] p-3 text-xs text-red-100">{error}</p> : null}
              {tab === "scenes" ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/42">Scene blueprints</h3>
                    <span className="text-[11px] text-white/34">Pick then configure</span>
                  </div>
                  {sceneBlueprints.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {sceneBlueprints.map((template) => {
                        const Icon = template.icon;
                        return (
                          <button key={template.name} type="button" onClick={() => setPresentation({ mode: "editor", tab: "scenes", scene: null, template })} className="w-[156px] shrink-0 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-3 text-left transition active:scale-[0.99]">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-400/10 text-sky-200"><Icon className="h-4 w-4" /></span>
                            <span className="mt-2 block truncate text-[13px] font-semibold text-white">{template.name}</span>
                            <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/42">{template.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-white/42">All blueprints shown here are already configured as scenes.</div>}
                </div>
              ) : null}
              {loading ? <Empty title="Loading..." body="Syncing your living environment." /> : items.length ? (
                <div className="mt-3 space-y-3">
                  {items.map((item) => {
                    const running = presentation.mode === "running" && presentation.sceneId === item.id;
                    return (
                      <div key={item.id} className="rounded-[24px] border border-white/[0.075] bg-white/[0.035] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                        <div className="flex items-center gap-3">
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-sky-300/14 bg-sky-400/10 text-sky-200">{tab === "scenes" ? <Moon className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold tracking-[-0.025em]">{item.name}</span>
                            <span className="mt-1 block text-xs text-white/42">{item.actions?.length || 0} controlled action{item.actions?.length === 1 ? "" : "s"}</span>
                          </span>
                          <span className="text-[11px] text-sky-200/72">{running ? "Running..." : tab === "scenes" ? "Ready" : (item as ConsumerAutomation).enabled ? "Enabled" : "Paused"}</span>
                        </div>
                        {item.actions?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{item.actions.slice(0, 3).map((action, index) => <span key={`${item.id}:${index}`} className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[10px] text-white/42">{describeAction(action)}</span>)}</div> : null}
                        <div className="mt-3 flex gap-2">
                          {tab === "scenes" ? (
                            <button type="button" onClick={() => void runScene(item as ConsumerScene)} disabled={presentation.mode === "running"} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{running ? "Running..." : "Run"}</button>
                          ) : (
                            <button type="button" onClick={() => void toggleAutomation(item as ConsumerAutomation)} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black">{(item as ConsumerAutomation).enabled ? "Pause" : "Resume"}</button>
                          )}
                          <button type="button" onClick={() => setPresentation({ mode: "editor", tab, scene: item as any, template: null })} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/68"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                          <button type="button" onClick={() => setDeletingItem(item as any)} className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-300/15 bg-red-500/[0.06] px-3 py-2 text-xs text-red-100/75"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty title={tab === "scenes" ? "No scenes yet." : "No automations yet."} body={tab === "scenes" ? "Create a scene to control multiple devices at once." : "Create an automation when you want your home to respond automatically."} />}
            </section>
          </div>
        </div>
        <BottomNav />
        {presentation.mode === "editor" || presentation.mode === "saving" ? (
          <SceneEditor
            mode={presentation}
            devices={devices}
            onCancel={returnToList}
            onSave={async (input) => {
              const current = presentation;
              const editing = current.mode === "editor" ? current.scene : null;
              setPresentation({ mode: "saving", tab: input.tab, sceneId: editing?.id });
              try {
                if (input.tab === "scenes") {
                  if (editing?.id) await sceneService.updateScene(editing.id, { name: input.name, description: input.description, actions: input.actions });
                  else await sceneService.createScene({ name: input.name, description: input.description, actions: input.actions });
                } else {
                  if (editing?.id) await sceneService.updateAutomation(editing.id, { name: input.name, trigger: { type: input.trigger }, condition: {}, actions: input.actions });
                  else await sceneService.createAutomation({ name: input.name, trigger: { type: input.trigger }, condition: {}, actions: input.actions, enabled: true });
                }
                await refresh();
                returnToList();
              } catch (err: any) {
                setPresentation({ mode: "editor", tab: input.tab, scene: editing, template: current.mode === "editor" ? current.template : null, error: err?.response?.data?.error || err?.message || "Could not save scene." });
              }
            }}
          />
        ) : null}
        {presentation.mode === "result" ? (
          <SceneResultSurface
            result={presentation.result}
            onClose={returnToList}
            onRunAgain={presentation.canRunAgain ? () => void runScene(presentation.canRunAgain!) : undefined}
          />
        ) : null}
        {deletingItem ? (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
            <button className="absolute inset-0" onClick={() => setDeletingItem(null)} aria-label="Cancel delete" />
            <section className="relative w-full max-w-[390px] rounded-[26px] border border-red-300/14 bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-100/48">Remove {tab === "scenes" ? "scene" : "automation"}</div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em]">Delete &quot;{deletingItem.name}&quot;?</h2>
              <p className="mt-2 text-sm leading-5 text-white/48">This removes it from this home. No device command will run.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeletingItem(null)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/68">Cancel</button>
                <button type="button" onClick={() => void deleteItem(deletingItem)} className="rounded-full bg-red-200 px-4 py-2.5 text-sm font-semibold text-red-950">Delete</button>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </LayoutWrapper>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5 text-center">
      <Sparkles className="mx-auto h-5 w-5 text-sky-200/62" />
      <div className="mt-2 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/42">{body}</div>
    </div>
  );
}

function SceneEditor({ mode, devices, onCancel, onSave }: { mode: Extract<ScenePresentation, { mode: "editor" | "saving" }>; devices: AnyDevice[]; onCancel: () => void; onSave: (input: { tab: Tab; name: string; description: string; trigger: string; actions: SceneAction[] }) => Promise<void> }) {
  const initial = mode.mode === "editor" ? mode.scene : null;
  const template = mode.mode === "editor" ? mode.template : null;
  const initialDeviceId = mode.mode === "editor" ? mode.initialDeviceId : "";
  const tab = mode.tab;
  const saving = mode.mode === "saving";
  const [name, setName] = useState(initial?.name || template?.name || "");
  const [description, setDescription] = useState((initial as ConsumerScene | null)?.description || template?.description || "");
  const [trigger, setTrigger] = useState(String((initial as ConsumerAutomation | null)?.trigger?.type || template?.trigger || "time"));
  const [expandedDeviceId, setExpandedDeviceId] = useState<string>("");
  const [actionSelections, setActionSelections] = useState<Record<string, ActionSelection>>(() => {
    const next: Record<string, ActionSelection> = {};
    const initialActions = Array.isArray(initial?.actions) ? initial!.actions : [];
    for (const action of initialActions) {
      const id = String(action.device_id || "");
      const [code, value] = commandEntries(action.command)[0] || [];
      if (!id || !code || typeof value !== "boolean") continue;
      next[selectionKey(id, String(code))] = { device_id: id, command_code: String(code), value, label: describeAction(action) };
    }
    if (!Object.keys(next).length && initialDeviceId) {
      const device = devices.find((item) => deviceId(item) === initialDeviceId);
      const option = device ? sceneActionOptions(device).options[0] : null;
      if (device && option?.valueType === "boolean") {
        const id = deviceId(device);
        next[selectionKey(id, option.code)] = {
          device_id: id,
          command_code: option.code,
          value: (template?.power || "on") === "on",
          label: `${option.label} -> ${(template?.power || "on") === "on" ? "On" : "Off"}`,
        };
      }
    }
    return next;
  });

  const initialSignature = useMemo(() => JSON.stringify({ name: initial?.name || template?.name || "", description: (initial as ConsumerScene | null)?.description || template?.description || "", trigger: (initial as ConsumerAutomation | null)?.trigger?.type || template?.trigger || "time", actions: initial?.actions || [] }), [initial, template]);
  const actions = useMemo(() => Object.values(actionSelections).map((selection) => ({
    device_id: selection.device_id,
    command: { [selection.command_code]: selection.value },
    label: selection.label,
    action_label: selection.label,
  })), [actionSelections]);
  const currentSignature = JSON.stringify({ name, description, trigger, actions });
  const dirty = currentSignature !== initialSignature;
  const canSave = Boolean(name.trim() && actions.length && !saving);
  const groupedDevices = useMemo(() => {
    const groups = new Map<string, AnyDevice[]>();
    for (const device of devices) {
      const room = roomName(device);
      groups.set(room, [...(groups.get(room) || []), device]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [devices]);

  function requestClose() {
    if (dirty && !window.confirm("Discard changes to this scene?")) return;
    onCancel();
  }

  function selectChannel(device: AnyDevice, option: ActionOption, value: boolean | null) {
    const id = deviceId(device);
    const key = selectionKey(id, option.code);
    setActionSelections((current) => {
      const next = { ...current };
      if (value === null) delete next[key];
      else next[key] = { device_id: id, command_code: option.code, value, label: `${option.label} -> ${value ? "On" : "Off"}` };
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[150] bg-[#02060b] text-white" role="dialog" aria-modal="true" aria-labelledby="scene-editor-title" aria-describedby="scene-editor-description">
      <div className="oyi-ambient-bg" />
      <header className="relative z-10 border-b border-white/[0.055] bg-[#02060b]/90 px-5 pb-3 pt-[calc(12px+var(--sat))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <button type="button" onClick={requestClose} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/72">Back</button>
          <div className="min-w-0 flex-1 text-center">
            <h2 id="scene-editor-title" className="truncate text-[16px] font-semibold tracking-[-0.03em]">{initial ? "Edit" : "Create"} {tab === "scenes" ? "scene" : "automation"}</h2>
            <p id="scene-editor-description" className="mt-0.5 text-[11px] text-white/38">{actions.length} selected action{actions.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" onClick={requestClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]" aria-label="Close scene editor"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="relative z-10 h-[calc(100dvh-var(--sat))] overflow-y-auto px-5 pb-[calc(96px+var(--sab))] pt-4">
        <div className="mx-auto max-w-[430px]">
          {mode.mode === "editor" && mode.error ? <p className="mb-3 rounded-[18px] border border-red-300/14 bg-red-500/[0.06] p-3 text-xs text-red-100">{mode.error}</p> : null}
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Scene name" className="h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm outline-none" />
          {tab === "scenes" ? <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" rows={2} className="mt-2 w-full resize-none rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-sm outline-none" /> : null}
          {tab === "automations" ? (
            <select value={trigger} onChange={(event) => setTrigger(event.target.value)} className="mt-2 h-11 w-full rounded-[16px] border border-white/[0.08] bg-[#07101c] px-3 text-sm">
              <option value="time">Time schedule</option>
              <option value="sunrise">Sunrise</option>
              <option value="sunset">Sunset</option>
              <option value="device">Device state</option>
              <option value="presence">Presence</option>
              <option value="manual">Manual trigger</option>
            </select>
          ) : null}
          <div className="mt-4 rounded-[20px] border border-white/[0.065] bg-white/[0.028] p-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">Selected actions</div>
            {actions.length ? <div className="mt-2 flex flex-wrap gap-1.5">{actions.map((action, index) => <span key={`${action.device_id}:${index}`} className="rounded-full border border-sky-300/16 bg-sky-400/8 px-2.5 py-1.5 text-[11px] text-sky-100/72">{describeAction(action)}</span>)}</div> : <p className="mt-2 text-xs text-white/42">Choose a device below, then set each channel to Not included, On, or Off.</p>}
          </div>
          <div className="mt-4 space-y-4">
            {groupedDevices.map(([room, roomDevices]) => (
              <section key={room}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">{room}</h3>
                <div className="space-y-2">
                  {roomDevices.map((device) => {
                    const id = deviceId(device);
                    const support = sceneActionOptions(device);
                    const expanded = expandedDeviceId === id;
                    const selectedForDevice = Object.values(actionSelections).filter((selection) => selection.device_id === id);
                    return (
                      <div key={id} className="rounded-[18px] border border-white/[0.065] bg-white/[0.028]">
                        <button type="button" onClick={() => setExpandedDeviceId(expanded ? "" : id)} className="flex w-full items-center gap-3 px-3 py-3 text-left" aria-expanded={expanded}>
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${support.supported ? "border-sky-300/18 bg-sky-400/10 text-sky-200" : "border-white/[0.06] bg-white/[0.025] text-white/30"}`}><Zap className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{deviceName(device)}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-white/38">{selectedForDevice.length ? selectedForDevice.map((item) => item.label).join(", ") : support.supported ? room : support.disabledReason}</span>
                          </span>
                          {expanded ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                        </button>
                        {expanded ? (
                          <div className="border-t border-white/[0.045] px-3 py-3">
                            {support.supported ? (
                              <div className="space-y-2">
                                {support.options.map((option) => {
                                  const selected = actionSelections[selectionKey(id, option.code)];
                                  return (
                                    <div key={option.code} className="flex items-center gap-2 rounded-[14px] bg-black/10 p-2">
                                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/72">{option.label}</span>
                                      {option.valueType === "boolean" ? (
                                        <div className="grid shrink-0 grid-cols-3 rounded-full border border-white/[0.07] bg-white/[0.025] p-0.5" role="group" aria-label={`${deviceName(device)} ${option.label}`}>
                                          <button type="button" onClick={() => selectChannel(device, option, null)} className={`rounded-full px-2.5 py-1.5 text-[11px] ${!selected ? "bg-white text-black" : "text-white/45"}`}>Not included</button>
                                          <button type="button" onClick={() => selectChannel(device, option, true)} className={`rounded-full px-2.5 py-1.5 text-[11px] ${selected?.value === true ? "bg-emerald-300 text-emerald-950" : "text-white/45"}`}>On</button>
                                          <button type="button" onClick={() => selectChannel(device, option, false)} className={`rounded-full px-2.5 py-1.5 text-[11px] ${selected?.value === false ? "bg-red-200 text-red-950" : "text-white/45"}`}>Off</button>
                                        </div>
                                      ) : <span className="text-[11px] text-amber-100/58">Value editing later</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : <p className="text-xs leading-5 text-white/42">{support.disabledReason}</p>}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {tab === "automations" ? <p className="mt-4 text-xs leading-5 text-amber-100/58">Saved automations are compatible with Runtime V2 actions. Automatic execution is not enabled yet.</p> : null}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[151] border-t border-white/[0.055] bg-[#02060b]/92 px-5 pb-[calc(14px+var(--sab))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-[430px]">
          <button type="button" disabled={!canSave} onClick={() => void onSave({ tab, name: name.trim(), description: description.trim(), trigger, actions })} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"><Zap className="h-4 w-4" /> {saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function SceneResultSurface({ result, onClose, onRunAgain }: { result: SceneRunResult; onClose: () => void; onRunAgain?: () => void }) {
  const successStatuses = ["completed", "accepted", "pending_confirmation"];
  const successful = result.actions.filter((action) => successStatuses.includes(action.status)).length;
  const pending = result.actions.filter((action) => action.status === "accepted" || action.status === "pending_confirmation").length;
  const failed = result.actions.length - successful;
  const headline = result.status === "failed"
    ? "The scene could not be completed."
    : result.status === "partially_completed"
      ? `${successful} actions completed. ${failed} device${failed === 1 ? "" : "s"} did not respond.`
      : `Scene completed across ${successful || result.counts.completed || result.counts.total} action${(successful || result.counts.completed || result.counts.total) === 1 ? "" : "s"}.`;
  return (
    <div className="fixed inset-0 z-[150] bg-[#02060b] text-white" role="dialog" aria-modal="true" aria-labelledby="scene-result-title" aria-describedby="scene-result-description">
      <div className="oyi-ambient-bg" />
      <header className="relative z-10 border-b border-white/[0.055] bg-[#02060b]/90 px-5 pb-3 pt-[calc(12px+var(--sat))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[430px] items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/72">Back</button>
          <div className="min-w-0 flex-1 text-center">
            <h2 id="scene-result-title" className="truncate text-[16px] font-semibold tracking-[-0.03em]">Scene result</h2>
            <p id="scene-result-description" className="mt-0.5 text-[11px] text-white/38">{statusCopy(result.status)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]" aria-label="Close scene result"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="relative z-10 h-[calc(100dvh-var(--sat))] overflow-y-auto px-5 pb-[calc(96px+var(--sab))] pt-4">
        <div className="mx-auto max-w-[430px]">
          <section className="rounded-[26px] border border-white/[0.08] bg-white/[0.04] p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">Completed run</div>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.04em]">{result.scene_name}</h3>
            <p className="mt-2 text-sm leading-5 text-white/58">{headline}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Metric label="Successful" value={successful} tone="emerald" />
              <Metric label="Pending" value={pending} tone="amber" />
              <Metric label="Failed" value={failed} tone="red" />
            </div>
          </section>
          <div className="mt-3 space-y-2">
            {(result.actions || []).map((action, index) => (
              <div key={`${action.device_id || index}:${index}`} className="flex items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${successStatuses.includes(action.status) ? "bg-emerald-400/12 text-emerald-100" : "bg-red-500/10 text-red-100"}`}>
                  {successStatuses.includes(action.status) ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{action.device_name || "Device"}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/40">{action.action_label || "Scene action"}</span>
                </span>
                <span className="shrink-0 text-[11px] text-white/48">{statusCopy(action.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-[151] border-t border-white/[0.055] bg-[#02060b]/92 px-5 pb-[calc(14px+var(--sab))] pt-3 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[430px] grid-cols-2 gap-2">
          {onRunAgain ? <button type="button" onClick={onRunAgain} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/72">Run again</button> : <span />}
          <button type="button" onClick={onClose} className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-black">Done</button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" }) {
  const colors = tone === "emerald" ? "text-emerald-100 bg-emerald-400/10" : tone === "amber" ? "text-amber-100 bg-amber-400/10" : "text-red-100 bg-red-500/10";
  return <div className={`rounded-[16px] p-3 text-center ${colors}`}><div className="text-lg font-semibold">{value}</div><div className="text-[10px] uppercase tracking-[0.14em] opacity-70">{label}</div></div>;
}
