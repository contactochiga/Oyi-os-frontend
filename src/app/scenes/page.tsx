"use client";

import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, Check, Clock3, Film, Home, Lock, Moon, Pencil, Plane, Plus, ShieldCheck, Sparkles, SunMedium, Trash2, X, Zap } from "lucide-react";

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
  return text(device?.name, device?.device_name, device?.alias, "Device");
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

  return { supported: false, options: [], disabledReason: "No safe scene action is exposed for this device yet." };
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
  const [createOpen, setCreateOpen] = useState(false);
  const [preselectedDeviceId, setPreselectedDeviceId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
  const [editingItem, setEditingItem] = useState<ConsumerScene | ConsumerAutomation | null>(null);
  const [deletingItem, setDeletingItem] = useState<ConsumerScene | ConsumerAutomation | null>(null);
  const [busyId, setBusyId] = useState("");
  const [runResult, setRunResult] = useState<SceneRunResult | null>(null);

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
      setPreselectedDeviceId(params.get("deviceId") || "");
      setCreateOpen(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [contextReady, activeContext.contextKey]);

  async function runScene(scene: ConsumerScene) {
    setBusyId(scene.id);
    setError("");
    try {
      const result = await sceneService.runScene(scene.id, scene.name);
      setRunResult(result);
      await refresh();
    } catch (err: any) {
      const result = err?.response?.data;
      if (result?.scene_run_id) setRunResult(result);
      setError(err?.response?.data?.error || err?.message || "Scene could not complete.");
    } finally {
      setBusyId("");
    }
  }

  async function toggleAutomation(automation: ConsumerAutomation) {
    setBusyId(automation.id);
    setError("");
    try { await sceneService.updateAutomation(automation.id, { enabled: !automation.enabled }); await refresh(); }
    catch (err: any) { setError(err?.response?.data?.error || err?.message || "Automation could not update."); }
    finally { setBusyId(""); }
  }

  async function deleteItem(item: ConsumerScene | ConsumerAutomation) {
    setBusyId(item.id);
    setError("");
    try {
      if (tab === "scenes") await sceneService.deleteScene(item.id);
      else await sceneService.deleteAutomation(item.id);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Could not delete item.");
    } finally {
      setBusyId("");
      setDeletingItem(null);
    }
  }

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
              <p className="mt-2 max-w-[310px] text-[13px] leading-5 text-white/52">Set the mood. Let your home respond.</p>
            </header>
            <div className="mt-5 flex gap-2">
              {(["scenes", "automations"] as Tab[]).map((key) => (
                <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full border px-3.5 py-2 text-xs font-medium capitalize ${tab === key ? "border-sky-300/55 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.025] text-white/52"}`}>{key}</button>
              ))}
            </div>
            <section className="mt-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-[-0.04em]">{tab === "scenes" ? "Scenes" : "Automations"}</h2>
                <button type="button" onClick={() => { setSelectedTemplate(null); setCreateOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs text-sky-100"><Plus className="h-3.5 w-3.5" /> Create</button>
              </div>
              {error ? <p className="mt-3 rounded-[18px] border border-red-300/14 bg-red-500/[0.06] p-3 text-xs text-red-100">{error}</p> : null}
              {tab === "scenes" ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/42">Scene blueprints</h3>
                    <span className="text-[11px] text-white/34">Configure once</span>
                  </div>
                  {sceneBlueprints.length ? (
                    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {sceneBlueprints.map((template) => {
                        const Icon = template.icon;
                        return (
                          <button key={template.name} type="button" onClick={() => { setSelectedTemplate(template); setEditingItem(null); setCreateOpen(true); }} className="w-[156px] shrink-0 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-3 text-left transition active:scale-[0.99]">
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
                  {items.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-white/[0.075] bg-white/[0.035] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-sky-300/14 bg-sky-400/10 text-sky-200">{tab === "scenes" ? <Moon className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold tracking-[-0.025em]">{item.name}</span>
                          <span className="mt-1 block text-xs text-white/42">{item.actions?.length || 0} controlled action{item.actions?.length === 1 ? "" : "s"}</span>
                        </span>
                        <span className="text-[11px] text-sky-200/72">{busyId === item.id ? "Working..." : tab === "scenes" ? "Ready" : (item as ConsumerAutomation).enabled ? "Enabled" : "Paused"}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {tab === "scenes" ? (
                          <button type="button" onClick={() => void runScene(item as ConsumerScene)} disabled={busyId === item.id} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">Run</button>
                        ) : (
                          <button type="button" onClick={() => void toggleAutomation(item as ConsumerAutomation)} disabled={busyId === item.id} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{(item as ConsumerAutomation).enabled ? "Pause" : "Resume"}</button>
                        )}
                        <button type="button" onClick={() => { setEditingItem(item as any); setCreateOpen(true); }} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/68"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                        <button type="button" onClick={() => setDeletingItem(item as any)} disabled={busyId === item.id} className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-300/15 bg-red-500/[0.06] px-3 py-2 text-xs text-red-100/75 disabled:opacity-45"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <Empty title={tab === "scenes" ? "No scenes yet." : "No automations yet."} body={tab === "scenes" ? "Create a scene to control multiple devices at once." : "Create an automation when you want your home to respond automatically."} />}
            </section>
          </div>
        </div>
        <BottomNav />
        {createOpen ? (
          <CreateSheet
            tab={tab}
            initial={editingItem}
            template={selectedTemplate}
            initialDeviceId={preselectedDeviceId}
            devices={devices}
            onClose={() => { setCreateOpen(false); setEditingItem(null); setSelectedTemplate(null); setPreselectedDeviceId(""); }}
            onSaved={async () => { setCreateOpen(false); setEditingItem(null); setSelectedTemplate(null); setPreselectedDeviceId(""); await refresh(); }}
          />
        ) : null}
        {runResult ? <SceneResultSheet result={runResult} onClose={() => setRunResult(null)} /> : null}
        {deletingItem ? (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
            <button className="absolute inset-0" onClick={() => setDeletingItem(null)} aria-label="Cancel delete" />
            <section className="relative w-full max-w-[390px] rounded-[26px] border border-red-300/14 bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-100/48">Remove {tab === "scenes" ? "scene" : "automation"}</div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em]">Delete &quot;{deletingItem.name}&quot;?</h2>
              <p className="mt-2 text-sm leading-5 text-white/48">This removes it from this home. No device command will run.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setDeletingItem(null)} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white/68">Cancel</button>
                <button type="button" onClick={() => void deleteItem(deletingItem)} disabled={busyId === deletingItem.id} className="rounded-full bg-red-200 px-4 py-2.5 text-sm font-semibold text-red-950 disabled:opacity-45">{busyId === deletingItem.id ? "Deleting..." : "Delete"}</button>
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

function CreateSheet({ tab, initial, template, initialDeviceId, devices, onClose, onSaved }: { tab: Tab; initial?: ConsumerScene | ConsumerAutomation | null; template?: SceneTemplate | null; initialDeviceId?: string; devices: AnyDevice[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name || template?.name || "");
  const [description, setDescription] = useState((initial as ConsumerScene | null)?.description || template?.description || "");
  const [trigger, setTrigger] = useState(String((initial as ConsumerAutomation | null)?.trigger?.type || template?.trigger || "time"));
  const [saving, setSaving] = useState(false);
  const [actionSelections, setActionSelections] = useState<Record<string, ActionSelection>>(() => {
    const next: Record<string, ActionSelection> = {};
    const initialActions = Array.isArray(initial?.actions) ? initial!.actions : [];
    for (const action of initialActions) {
      const id = String(action.device_id || "");
      const [code, value] = commandEntries(action.command)[0] || [];
      if (!id || !code || typeof value !== "boolean") continue;
      next[selectionKey(id, String(code))] = {
        device_id: id,
        command_code: String(code),
        value,
        label: describeAction(action),
      };
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

  const actions = useMemo(() => Object.values(actionSelections).map((selection) => ({
    device_id: selection.device_id,
    command: { [selection.command_code]: selection.value },
    label: selection.label,
    action_label: selection.label,
  })), [actionSelections]);
  const canSave = useMemo(() => Boolean(name.trim() && actions.length), [name, actions.length]);

  function updateSelection(device: AnyDevice, option: ActionOption, value: boolean) {
    const id = deviceId(device);
    const key = selectionKey(id, option.code);
    setActionSelections((current) => ({
      ...current,
      [key]: {
        device_id: id,
        command_code: option.code,
        value,
        label: `${option.label} -> ${value ? "On" : "Off"}`,
      },
    }));
  }

  function removeSelection(device: AnyDevice, option: ActionOption) {
    const key = selectionKey(deviceId(device), option.code);
    setActionSelections((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      if (tab === "scenes") {
        if (initial?.id) await sceneService.updateScene(initial.id, { name: name.trim(), description: description.trim(), actions });
        else await sceneService.createScene({ name: name.trim(), description: description.trim(), actions });
      } else {
        if (initial?.id) await sceneService.updateAutomation(initial.id, { name: name.trim(), trigger: { type: trigger }, condition: {}, actions });
        else await sceneService.createAutomation({ name: name.trim(), trigger: { type: trigger }, condition: {}, actions, enabled: true });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <section className="relative flex max-h-[min(86dvh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.055] px-4 py-3.5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">Living environment</div>
            <h2 className="mt-1 text-lg font-semibold">{initial ? "Edit" : "Create"} {tab === "scenes" ? "scene" : "automation"}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm outline-none" />
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
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">Actions</div>
            <span className="text-[11px] text-white/34">{actions.length} selected</span>
          </div>
          <div className="mt-2 space-y-2">
            {devices.length ? devices.map((device) => {
              const id = deviceId(device);
              const support = sceneActionOptions(device);
              return (
                <div key={id} className={`rounded-[18px] border px-3 py-3 ${support.supported ? "border-white/[0.07] bg-white/[0.03]" : "border-white/[0.045] bg-white/[0.018]"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${support.supported ? "border-sky-300/18 bg-sky-400/10 text-sky-200" : "border-white/[0.06] bg-white/[0.025] text-white/28"}`}><Zap className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{deviceName(device)}</span>
                      {support.supported ? <span className="mt-1 block text-[11px] text-white/38">Choose each channel or action independently.</span> : <span className="mt-1 block text-[11px] leading-4 text-white/34">{support.disabledReason}</span>}
                    </span>
                  </div>
                  {support.supported ? (
                    <div className="mt-3 space-y-2">
                      {support.options.map((option) => {
                        const key = selectionKey(id, option.code);
                        const selected = actionSelections[key];
                        const isOn = selected?.value === true;
                        const isOff = selected?.value === false;
                        const selectedLabel = selected ? (selected.value ? "On" : "Off") : "Not included";
                        return (
                          <div key={option.code} className="rounded-[15px] border border-white/[0.055] bg-black/10 p-2">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate text-xs font-medium text-white/72">{option.label}</span>
                              <span className="text-[10px] uppercase tracking-[0.16em] text-white/32">{selectedLabel}</span>
                            </div>
                            {option.valueType === "boolean" ? (
                              <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                                <button type="button" onClick={() => updateSelection(device, option, true)} className={`rounded-full border px-2.5 py-2 text-xs ${isOn ? "border-emerald-300/45 bg-emerald-400/14 text-emerald-100" : "border-white/[0.07] bg-white/[0.025] text-white/46"}`}>On</button>
                                <button type="button" onClick={() => updateSelection(device, option, false)} className={`rounded-full border px-2.5 py-2 text-xs ${isOff ? "border-red-300/35 bg-red-500/10 text-red-100" : "border-white/[0.07] bg-white/[0.025] text-white/46"}`}>Off</button>
                                <button type="button" onClick={() => removeSelection(device, option)} disabled={!selected} className="rounded-full border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-xs text-white/42 disabled:opacity-30">Remove</button>
                              </div>
                            ) : (
                              <div className="rounded-[13px] border border-amber-200/10 bg-amber-400/[0.04] p-2 text-[11px] leading-4 text-amber-100/58">This action is capability-detected, but editing values for it will be enabled in a later phase.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }) : <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-white/46">No controllable devices available.</div>}
          </div>
          {tab === "automations" ? <p className="mt-3 text-xs leading-5 text-amber-100/58">Saved automations are compatible with Runtime V2 actions. Automatic execution is not enabled yet.</p> : null}
          <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"><Zap className="h-4 w-4" /> {saving ? "Saving..." : initial ? "Save changes" : "Save"}</button>
        </div>
      </section>
    </div>
  );
}

function SceneResultSheet({ result, onClose }: { result: SceneRunResult; onClose: () => void }) {
  const isPartial = result.status === "partially_completed";
  const isFailed = result.status === "failed";
  const headline = isFailed
    ? "The scene could not be completed."
    : isPartial
      ? `${result.counts.completed} actions completed. ${result.counts.failed} device${result.counts.failed === 1 ? "" : "s"} did not respond.`
      : `Scene completed across ${result.counts.completed || result.counts.total} action${(result.counts.completed || result.counts.total) === 1 ? "" : "s"}.`;
  return (
    <div className="fixed inset-0 z-[155] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close scene result" />
      <section className="relative w-full max-w-[410px] rounded-[28px] border border-white/[0.08] bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">Scene result</div>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em]">{result.scene_name}</h2>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-3 text-sm leading-5 text-white/58">{headline}</p>
        <div className="mt-3 space-y-2">
          {(result.actions || []).map((action, index) => (
            <div key={`${action.device_id || index}:${index}`} className="flex items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${["completed", "accepted", "pending_confirmation"].includes(action.status) ? "bg-emerald-400/12 text-emerald-100" : "bg-red-500/10 text-red-100"}`}>
                {["completed", "accepted", "pending_confirmation"].includes(action.status) ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{action.device_name || "Device"}</span>
                <span className="mt-0.5 block truncate text-[11px] text-white/40">{action.action_label || "Scene action"}</span>
              </span>
              <span className="shrink-0 text-[11px] text-white/48">{statusCopy(action.status)}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-black">Close</button>
      </section>
    </div>
  );
}
