"use client";

import { useEffect, useMemo, useState } from "react";
import { BatteryCharging, Check, Clock3, Film, Home, Lock, Moon, Pencil, Plane, Plus, ShieldCheck, Sparkles, SunMedium, Trash2, X, Zap } from "lucide-react";

import BottomNav from "@/app/components/BottomNav";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import LayoutWrapper from "@/app/components/LayoutWrapper";
import MessagesInboxButton from "@/app/components/MessagesInboxButton";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import { sceneService, type ConsumerAutomation, type ConsumerScene } from "@/services/sceneService";

type Tab = "scenes" | "automations";
type AnyDevice = Record<string, any>;
type SceneTemplate = { name: string; icon: any; description: string; power: "on" | "off"; trigger?: string };

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

function deviceId(device: AnyDevice) { return String(device?.id || device?.external_id || ""); }
function deviceName(device: AnyDevice) { return String(device?.name || device?.alias || "Device"); }

export default function ScenesPage() {
  const { user } = useAuth();
  const estateId = (user as any)?.estate_id || "";
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

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [nextScenes, nextAutomations, nextDevices] = await Promise.all([
        sceneService.listScenes(),
        sceneService.listAutomations(),
        deviceService.getAssignedDevices(estateId),
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

  useEffect(() => { void refresh(); }, [estateId]);

  async function runScene(scene: ConsumerScene) {
    setBusyId(scene.id);
    setError("");
    try { await sceneService.runScene(scene.id); }
    catch (err: any) { setError(err?.response?.data?.error || err?.message || "Scene could not complete."); }
    finally { setBusyId(""); }
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
    } finally { setBusyId(""); setDeletingItem(null); }
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
              {(["scenes", "automations"] as Tab[]).map((key) => <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-full border px-3.5 py-2 text-xs font-medium capitalize ${tab === key ? "border-sky-300/55 bg-sky-400/12 text-sky-100" : "border-white/[0.07] bg-white/[0.025] text-white/52"}`}>{key}</button>)}
            </div>
            <section className="mt-5">
              <div className="flex items-center justify-between"><h2 className="text-[17px] font-semibold tracking-[-0.04em]">{tab === "scenes" ? "Scenes" : "Automations"}</h2><button type="button" onClick={() => { setSelectedTemplate(null); setCreateOpen(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-2 text-xs text-sky-100"><Plus className="h-3.5 w-3.5" /> Create</button></div>
              {error ? <p className="mt-3 rounded-[18px] border border-red-300/14 bg-red-500/[0.06] p-3 text-xs text-red-100">{error}</p> : null}
              {tab === "scenes" ? (
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/42">Scene blueprints</h3>
                    <span className="text-[11px] text-white/34">Configure once</span>
                  </div>
                  {sceneBlueprints.length ? <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  </div> : <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-3 text-xs text-white/42">All blueprints shown here are already configured as scenes.</div>}
                </div>
              ) : null}
              {loading ? <Empty title="Loading…" body="Syncing your living environment." /> : items.length ? (
                <div className="mt-3 space-y-3">
                  {items.map((item) => <div key={item.id} className="rounded-[24px] border border-white/[0.075] bg-white/[0.035] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-sky-300/14 bg-sky-400/10 text-sky-200">{tab === "scenes" ? <Moon className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold tracking-[-0.025em]">{item.name}</span><span className="mt-1 block text-xs text-white/42">{item.actions?.length || 0} controlled action{item.actions?.length === 1 ? "" : "s"}</span></span>
                      <span className="text-[11px] text-sky-200/72">{busyId === item.id ? "Working…" : tab === "scenes" ? "Ready" : item.enabled ? "Enabled" : "Paused"}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {tab === "scenes" ? <button type="button" onClick={() => void runScene(item as ConsumerScene)} disabled={busyId === item.id} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">Run</button> : <button type="button" onClick={() => void toggleAutomation(item as ConsumerAutomation)} disabled={busyId === item.id} className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-45">{(item as ConsumerAutomation).enabled ? "Pause" : "Resume"}</button>}
                      <button type="button" onClick={() => { setEditingItem(item as any); setCreateOpen(true); }} className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/68"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button type="button" onClick={() => setDeletingItem(item as any)} disabled={busyId === item.id} className="ml-auto inline-flex items-center gap-1 rounded-full border border-red-300/15 bg-red-500/[0.06] px-3 py-2 text-xs text-red-100/75 disabled:opacity-45"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </div>)}
                </div>
              ) : <Empty title={tab === "scenes" ? "No scenes yet." : "No automations yet."} body={tab === "scenes" ? "Create a scene to control multiple devices at once." : "Create an automation when you want your home to respond automatically."} />}
            </section>
          </div>
        </div>
        <BottomNav />
        {createOpen ? <CreateSheet tab={tab} initial={editingItem} template={selectedTemplate} initialDeviceId={preselectedDeviceId} devices={devices} onClose={() => { setCreateOpen(false); setEditingItem(null); setSelectedTemplate(null); setPreselectedDeviceId(""); }} onSaved={async () => { setCreateOpen(false); setEditingItem(null); setSelectedTemplate(null); setPreselectedDeviceId(""); await refresh(); }} /> : null}
        {deletingItem ? (
          <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md">
            <button className="absolute inset-0" onClick={() => setDeletingItem(null)} aria-label="Cancel delete" />
            <section className="relative w-full max-w-[390px] rounded-[26px] border border-red-300/14 bg-[#050a12]/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-100/48">Remove {tab === "scenes" ? "scene" : "automation"}</div>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.04em]">Delete “{deletingItem.name}”?</h2>
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

function Empty({ title, body }: { title: string; body: string }) { return <div className="mt-3 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-5 text-center"><Sparkles className="mx-auto h-5 w-5 text-sky-200/62" /><div className="mt-2 text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-white/42">{body}</div></div>; }

function CreateSheet({ tab, initial, template, initialDeviceId, devices, onClose, onSaved }: { tab: Tab; initial?: ConsumerScene | ConsumerAutomation | null; template?: SceneTemplate | null; initialDeviceId?: string; devices: AnyDevice[]; onClose: () => void; onSaved: () => void }) {
  const initialDeviceIds = Array.isArray(initial?.actions) ? initial!.actions.map((action) => String(action.device_id || "")).filter(Boolean) : initialDeviceId ? [initialDeviceId] : [];
  const [name, setName] = useState(initial?.name || template?.name || "");
  const [description, setDescription] = useState((initial as ConsumerScene | null)?.description || template?.description || "");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialDeviceIds);
  const [power, setPower] = useState<"on" | "off">(initial?.actions?.length ? ((initial?.actions?.[0]?.command?.switch ?? initial?.actions?.[0]?.command?.power ?? true) ? "on" : "off") : template?.power || "on");
  const [trigger, setTrigger] = useState(String((initial as ConsumerAutomation | null)?.trigger?.type || template?.trigger || "time"));
  const [saving, setSaving] = useState(false);
  const canSave = useMemo(() => name.trim() && selectedIds.length, [name, selectedIds]);
  function toggleDevice(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  async function save() {
    if (!canSave) return;
    setSaving(true);
    const actions = selectedIds.map((device_id) => ({ device_id, command: { switch: power === "on" } }));
    try {
      if (tab === "scenes") {
        if (initial?.id) await sceneService.updateScene(initial.id, { name: name.trim(), description: description.trim(), actions });
        else await sceneService.createScene({ name: name.trim(), description: description.trim(), actions });
      } else {
        if (initial?.id) await sceneService.updateAutomation(initial.id, { name: name.trim(), trigger: { type: trigger }, condition: {}, actions });
        else await sceneService.createAutomation({ name: name.trim(), trigger: { type: trigger }, condition: {}, actions, enabled: true });
      }
      onSaved();
    } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55 px-4 pb-[calc(16px+var(--sab))] backdrop-blur-md"><button className="absolute inset-0" onClick={onClose} aria-label="Close" /><section className="relative flex max-h-[min(82dvh,680px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#050a12]/96"><div className="flex shrink-0 items-center justify-between border-b border-white/[0.055] px-4 py-3.5"><div><div className="text-[10px] uppercase tracking-[0.2em] text-sky-100/48">Living environment</div><h2 className="mt-1 text-lg font-semibold">{initial ? "Edit" : "Create"} {tab === "scenes" ? "scene" : "automation"}</h2></div><button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]"><X className="h-4 w-4" /></button></div><div className="min-h-0 flex-1 overflow-y-auto p-4"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-11 w-full rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm outline-none" />{tab === "scenes" ? <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="mt-2 w-full resize-none rounded-[16px] border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 text-sm outline-none" /> : null}{tab === "automations" ? <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="mt-2 h-11 w-full rounded-[16px] border border-white/[0.08] bg-[#07101c] px-3 text-sm"><option value="time">Time schedule</option><option value="sunrise">Sunrise</option><option value="sunset">Sunset</option><option value="device">Device state</option><option value="presence">Presence</option><option value="manual">Manual trigger</option></select> : null}<div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/34">Devices</div><div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">{devices.length ? devices.map((device) => { const id = deviceId(device); const checked = selectedIds.includes(id); return <button key={id} type="button" onClick={() => toggleDevice(id)} className={`flex w-full items-center gap-3 rounded-[16px] border px-3 py-2.5 text-left ${checked ? "border-sky-300/35 bg-sky-400/10" : "border-white/[0.07] bg-white/[0.03]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${checked ? "border-sky-200 bg-sky-400/40" : "border-white/20"}`}>{checked ? <Check className="h-3 w-3" /> : null}</span><span className="min-w-0 flex-1 truncate text-sm">{deviceName(device)}</span></button>; }) : <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.025] px-3 py-3 text-sm text-white/46">No controllable devices available.</div>}</div><div className="mt-3 grid grid-cols-2 gap-2">{(["on", "off"] as const).map((value) => <button key={value} type="button" onClick={() => setPower(value)} className={`rounded-full border px-3 py-2 text-xs uppercase ${power === value ? "border-sky-300/50 bg-sky-400/12" : "border-white/[0.08] bg-white/[0.03]"}`}>{value}</button>)}</div>{tab === "automations" ? <p className="mt-3 text-xs leading-5 text-amber-100/58">Saved automations are ready for the scheduler worker. Automatic execution is not enabled yet.</p> : null}<button type="button" disabled={!canSave || saving} onClick={() => void save()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"><Zap className="h-4 w-4" /> {saving ? "Saving…" : initial ? "Save changes" : "Save"}</button></div></section></div>;
}
