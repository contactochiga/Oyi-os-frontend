// src/app/devices/DeviceClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import { deviceService } from "@/services/deviceService";
import GangRingSwitch from "@/app/components/devices/GangRingSwitch";
import CameraIntelPanel from "@/app/components/devices/CameraIntelPanel";

type AnyDevice = Record<string, any>;
type DiscoveryDevice = Record<string, any>;

function pickDbId(d: AnyDevice) {
  return d?.id || null; // ✅ DB uuid
}

function pickExternalId(d: AnyDevice) {
  return (
    d?.external_id ||
    d?.externalId ||
    d?.device_id ||
    d?.dev_id ||
    d?.devId ||
    d?.uuid ||
    null
  );
}

function pickName(d: AnyDevice) {
  return d?.name || d?.local_name || d?.localName || d?.alias || "Unnamed Device";
}

function pickVendor(d: AnyDevice) {
  return d?.vendor || d?.adapter || d?.protocol || d?.brand || "device";
}

function pickRoomName(d: AnyDevice) {
  return d?.room_name || d?.room?.name || d?.metadata?.room_name || null;
}

function pickDiscoveryExternalId(d: DiscoveryDevice) {
  return (
    d?.external_id ||
    d?.externalId ||
    d?.device_id ||
    d?.dev_id ||
    d?.uuid ||
    null
  );
}

function isOnline(d: AnyDevice): boolean | null {
  if (typeof d?.online === "boolean") return d.online;
  if (typeof d?.isOnline === "boolean") return d.isOnline;
  if (typeof d?.connected === "boolean") return d.connected;

  if (typeof d?.status === "string") {
    const s = d.status.toLowerCase();
    if (s.includes("online")) return true;
    if (s.includes("offline")) return false;
  }
  return null;
}

function statusDot(online: boolean | null) {
  if (online === null) return "bg-white/20";
  return online ? "bg-emerald-500" : "bg-white/25";
}

function prettyState(state: any) {
  try {
    return JSON.stringify(state ?? {}, null, 2);
  } catch {
    return String(state ?? "");
  }
}

function guessGangCount(device: AnyDevice, state: any): 1 | 2 | 3 {
  const raw = (device?.metadata?.raw ?? device?.metadata ?? device?.meta ?? {}) as any;

  const rawKeys = Object.keys(raw || {});
  const has2 = rawKeys.some((k) => k === "switch_2" || k === "switch_2_code");
  const has3 = rawKeys.some((k) => k === "switch_3" || k === "switch_3_code");
  if (has3) return 3;
  if (has2) return 2;

  const keys = Object.keys(state || {});
  if (keys.includes("switch_3")) return 3;
  if (keys.includes("switch_2")) return 2;

  const dps = state?.dps || state?.raw?.dps;
  if (dps && typeof dps === "object") {
    const dpKeys = Object.keys(dps);
    if (dpKeys.some((k) => String(k).includes("switch_3"))) return 3;
    if (dpKeys.some((k) => String(k).includes("switch_2"))) return 2;
  }

  return 1;
}

function readGangValues(gangCount: 1 | 2 | 3, state: any): Array<boolean | null> {
  const out: Array<boolean | null> = [];
  for (let i = 1; i <= gangCount; i++) {
    const k = `switch_${i}`;
    const v = state?.[k];
    out.push(typeof v === "boolean" ? v : null);
  }

  if (gangCount === 1 && out[0] === null) {
    const v = state?.switch ?? state?.power ?? state?.on;
    if (typeof v === "boolean") out[0] = v;
  }

  return out;
}

function normalizeCommandKey(gangCount: 1 | 2 | 3, gangIndex: number) {
  return gangCount === 1 ? "switch" : `switch_${gangIndex + 1}`;
}

function powerButtonClass(isOn: boolean | null) {
  if (isOn === null) return "bg-white/10 text-white/70 border-white/10";
  return isOn
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
    : "bg-white/10 text-white/70 border-white/10";
}

type SceneKey = "welcome_home" | "evening" | "all_off" | "away_mode";
type AutomationKey = "night_guard" | "energy_saver" | "presence_watch";
type CustomScene = {
  id: string;
  name: string;
  targetOn: boolean;
  deviceIds: string[];
  createdAt: number;
};
type CustomAutomation = {
  id: string;
  name: string;
  schedule: string;
  sceneId: string;
  enabled: boolean;
  createdAt: number;
};

function pickType(d: AnyDevice) {
  return d?.type || d?.device_type || d?.category || d?.kind || "";
}

function inferFamily(d: AnyDevice) {
  const source = `${pickType(d)} ${pickName(d)} ${pickVendor(d)}`.toLowerCase();
  if (source.includes("light")) return "light";
  if (source.includes("switch")) return "switch";
  if (source.includes("outlet") || source.includes("plug") || source.includes("socket")) return "outlet";
  if (source.includes("ac") || source.includes("air")) return "hvac";
  if (source.includes("curtain") || source.includes("blind")) return "curtain";
  if (source.includes("camera") || source.includes("cctv") || source.includes("onvif")) return "camera";
  if (source.includes("lock") || source.includes("door")) return "access";
  if (source.includes("sensor") || source.includes("motion") || source.includes("pir")) return "sensor";
  if (source.includes("smoke") || source.includes("alarm")) return "safety";
  return "generic";
}

export default function DeviceClient() {
  const { user } = useAuth();

  const estateId = useMemo(
    () =>
      (user as any)?.estate_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user]
  );
  const homeId = useMemo(
    () =>
      (user as any)?.home_id ??
      (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [items, setItems] = useState<AnyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [familyFilter, setFamilyFilter] = useState<string>("all");

  // device state cache (by DB id)
  const [stateMap, setStateMap] = useState<Record<string, any>>({});

  // details modal
  const [stateOpen, setStateOpen] = useState(false);
  const [stateTitle, setStateTitle] = useState<string>("Device");
  const [stateMeta, setStateMeta] = useState<{ id?: string; vendor?: string; external_id?: string } | null>(null);
  const [stateBody, setStateBody] = useState<string>("{}");
  const [stateLoading, setStateLoading] = useState(false);

  // bottom sheet for controls
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDevice, setSheetDevice] = useState<AnyDevice | null>(null);
  const [sceneBusy, setSceneBusy] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [autoEnabled, setAutoEnabled] = useState<Record<AutomationKey, boolean>>({
    night_guard: true,
    energy_saver: true,
    presence_watch: false,
  });
  const [customScenes, setCustomScenes] = useState<CustomScene[]>([]);
  const [customAutomations, setCustomAutomations] = useState<CustomAutomation[]>([]);
  const [sceneFormOpen, setSceneFormOpen] = useState(false);
  const [automationFormOpen, setAutomationFormOpen] = useState(false);
  const [sceneName, setSceneName] = useState("");
  const [sceneTargetOn, setSceneTargetOn] = useState(true);
  const [sceneDeviceIds, setSceneDeviceIds] = useState<string[]>([]);
  const [automationName, setAutomationName] = useState("");
  const [automationSchedule, setAutomationSchedule] = useState("Every day • 7:00 PM");
  const [automationSceneId, setAutomationSceneId] = useState("");
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [binding, setBinding] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveryDevice[]>([]);
  const [selectedDiscover, setSelectedDiscover] = useState<Record<string, boolean>>({});
  const [bindRoom, setBindRoom] = useState("");

  async function hydrateStates(list: AnyDevice[]) {
    if (!Array.isArray(list) || list.length === 0) {
      setLastSyncAt(Date.now());
      return;
    }

    const jobs = list
      .map((d) => ({ sid: pickDbId(d) ? String(pickDbId(d)) : null }))
      .filter((x) => x.sid)
      .map(async ({ sid }) => {
        try {
          const res = await deviceService.getDeviceState(String(sid));
          return { sid: String(sid), state: (res as any)?.state ?? res ?? {} };
        } catch {
          return null;
        }
      });

    const settled = await Promise.allSettled(jobs);
    const patch: Record<string, any> = {};

    settled.forEach((s) => {
      if (s.status !== "fulfilled") return;
      if (!s.value?.sid) return;
      patch[s.value.sid] = s.value.state;
    });

    if (Object.keys(patch).length) {
      setStateMap((prev) => ({ ...prev, ...patch }));
    }
    setLastSyncAt(Date.now());
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await deviceService.getDevices(estateId || undefined);
      const nextList = Array.isArray(list) ? list : [];
      setItems(nextList);
      await hydrateStates(nextList);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load devices");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estateId]);

  useEffect(() => {
    if (!items.length) return;
    const t = window.setInterval(() => {
      hydrateStates(items);
    }, 20000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `oyi_device_automation_${estateId || "global"}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        setAutoEnabled((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore storage errors
    }
  }, [estateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `oyi_device_automation_${estateId || "global"}`;
    try {
      localStorage.setItem(key, JSON.stringify(autoEnabled));
    } catch {
      // ignore storage errors
    }
  }, [estateId, autoEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scenesKey = `oyi_custom_scenes_${estateId || "global"}`;
    const autosKey = `oyi_custom_automations_${estateId || "global"}`;
    try {
      const rawScenes = localStorage.getItem(scenesKey);
      const rawAutos = localStorage.getItem(autosKey);
      if (rawScenes) {
        const parsed = JSON.parse(rawScenes);
        if (Array.isArray(parsed)) setCustomScenes(parsed);
      }
      if (rawAutos) {
        const parsed = JSON.parse(rawAutos);
        if (Array.isArray(parsed)) setCustomAutomations(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, [estateId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scenesKey = `oyi_custom_scenes_${estateId || "global"}`;
    try {
      localStorage.setItem(scenesKey, JSON.stringify(customScenes));
    } catch {
      // ignore storage errors
    }
  }, [estateId, customScenes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const autosKey = `oyi_custom_automations_${estateId || "global"}`;
    try {
      localStorage.setItem(autosKey, JSON.stringify(customAutomations));
    } catch {
      // ignore storage errors
    }
  }, [estateId, customAutomations]);

  const filtered = useMemo(() => {
    const t = (q || "").trim().toLowerCase();
    return items.filter((d) => {
      const family = inferFamily(d);
      if (familyFilter !== "all" && family !== familyFilter) return false;
      if (!t) return true;
      const name = String(pickName(d)).toLowerCase();
      const vendor = String(pickVendor(d)).toLowerCase();
      const room = String(pickRoomName(d) ?? "").toLowerCase();
      const ext = String(pickExternalId(d) ?? "").toLowerCase();
      return name.includes(t) || vendor.includes(t) || room.includes(t) || ext.includes(t);
    });
  }, [q, items, familyFilter]);

  const familyCounts = useMemo(() => {
    const out: Record<string, number> = {
      all: items.length,
      light: 0,
      switch: 0,
      hvac: 0,
      camera: 0,
      access: 0,
      sensor: 0,
      safety: 0,
    };
    items.forEach((d) => {
      const f = inferFamily(d);
      if (typeof out[f] === "number") out[f] += 1;
    });
    return out;
  }, [items]);

  async function warmState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;

    const sid = String(dbId);
    if (stateMap[sid]) return;

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = (res as any)?.state ?? res ?? {};
      setStateMap((p) => ({ ...p, [sid]: state }));
    } catch {
      // silent
    }
  }

  function buildPowerCommand(device: AnyDevice, state: any, next: boolean) {
    const gangCount = guessGangCount(device, state);
    if (gangCount === 1) return { switch: next };
    const out: Record<string, boolean> = {};
    for (let i = 1; i <= gangCount; i++) {
      out[`switch_${i}`] = next;
    }
    return out;
  }

  function currentIsOn(device: AnyDevice, state: any): boolean | null {
    if (!state) return null;

    // prefer dp-like switches first if present
    const v =
      state?.switch ??
      state?.power ??
      state?.on ??
      null;

    if (typeof v === "boolean") return v;

    // fallback: if any switch_i is true, treat as "on"
    const keys = ["switch_1", "switch_2", "switch_3"];
    for (const k of keys) {
      if (typeof state?.[k] === "boolean" && state[k] === true) return true;
    }
    // if we can see them but all false
    const hasAny = keys.some((k) => typeof state?.[k] === "boolean");
    if (hasAny) return false;

    return null;
  }

  async function toggleGang(device: AnyDevice, gangIndex: number, next: boolean) {
    const dbId = pickDbId(device);
    if (!dbId) {
      setErr("This device has no DB id yet. Bind/assign it first.");
      return;
    }

    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);

    try {
      await warmState(device);

      const cached = stateMap[sid] || {};
      const gangCount = guessGangCount(device, cached);
      const code = normalizeCommandKey(gangCount, gangIndex);

      await deviceService.commandDevice(sid, { [code]: next });

      // optimistic UI
      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) {
          return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        }
        return { ...p, [sid]: { ...prev, [`switch_${gangIndex + 1}`]: next } };
      });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  // ✅ card power button: full ON/OFF
  // - 1-gang => switch
  // - multi-gang => switch_1..switch_n all together
  async function toggleMasterPower(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) {
      setErr("This device has no DB id yet. Bind/assign it first.");
      return;
    }

    const sid = String(dbId);
    setBusyId(sid);
    setErr(null);

    try {
      await warmState(device);

      const cached = stateMap[sid] || {};
      const nowOn = currentIsOn(device, cached);
      const next = nowOn === null ? true : !nowOn;
      const gangCount = guessGangCount(device, cached);
      const command = buildPowerCommand(device, cached, next);

      await deviceService.commandDevice(sid, command);

      // optimistic UI
      setStateMap((p) => {
        const prev = p[sid] || {};
        if (gangCount === 1) {
          return { ...p, [sid]: { ...prev, switch: next, power: next, on: next } };
        }
        const patch: any = {};
        for (let i = 1; i <= gangCount; i++) patch[`switch_${i}`] = next;
        return { ...p, [sid]: { ...prev, ...patch } };
      });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Command failed (device may be offline)");
    } finally {
      setBusyId(null);
    }
  }

  async function executeSceneTarget(targetOn: boolean, busyKey: string, allowedIds?: string[]) {
    if (!items.length) return;
    setSceneBusy(busyKey);
    setErr(null);
    try {
      const allow = allowedIds && allowedIds.length ? new Set(allowedIds) : null;
      const candidates = items.filter((d) => {
        const dbId = pickDbId(d);
        if (!dbId) return false;
        const sid = String(dbId);
        if (allow && !allow.has(sid)) return false;
        const family = inferFamily(d);
        if (family === "camera" || family === "sensor" || family === "safety") return false;
        return isOnline(d) !== false;
      });

      const jobs = candidates.map(async (d) => {
        const sid = String(pickDbId(d));
        const cached = stateMap[sid] || {};
        const family = inferFamily(d);
        const command = family === "curtain" ? { open: targetOn } : buildPowerCommand(d, cached, targetOn);

        try {
          await deviceService.commandDevice(sid, command);
          return { sid, ok: true, command };
        } catch {
          return { sid, ok: false, command };
        }
      });

      const results = await Promise.all(jobs);
      const patch: Record<string, any> = {};
      results.forEach((r) => {
        if (!r.ok) return;
        patch[r.sid] = { ...(stateMap[r.sid] || {}), ...r.command };
      });
      if (Object.keys(patch).length) {
        setStateMap((prev) => ({ ...prev, ...patch }));
      }
      await hydrateStates(items);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Scene command failed");
    } finally {
      setSceneBusy(null);
    }
  }

  async function runScene(scene: SceneKey) {
    const targetOn = scene === "all_off" || scene === "away_mode" ? false : true;
    await executeSceneTarget(targetOn, scene);
  }

  async function runCustomScene(scene: CustomScene) {
    await executeSceneTarget(scene.targetOn, scene.id, scene.deviceIds);
  }

  function openSheet(device: AnyDevice) {
    setSheetDevice(device);
    setSheetOpen(true);
    // warm quickly so ring state shows immediately
    warmState(device);
  }

  async function viewState(device: AnyDevice) {
    const dbId = pickDbId(device);
    if (!dbId) return;

    const sid = String(dbId);
    const ext = pickExternalId(device);

    setStateTitle(pickName(device));
    setStateMeta({ id: sid, vendor: pickVendor(device), external_id: ext ? String(ext) : undefined });
    setStateBody("{}");
    setStateOpen(true);
    setStateLoading(true);

    try {
      const res = await deviceService.getDeviceState(sid);
      const state = (res as any)?.state ?? res ?? {};
      setStateBody(prettyState(state));
      setStateMap((p) => ({ ...p, [sid]: state }));
    } catch (e: any) {
      setStateBody(
        prettyState({
          error: e?.response?.data?.error || e?.message || "Failed to load device state",
        })
      );
    } finally {
      setStateLoading(false);
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  }

  const onlineCount = useMemo(
    () => items.reduce((acc, d) => (isOnline(d) === true ? acc + 1 : acc), 0),
    [items]
  );

  const onStateCount = useMemo(() => {
    return items.reduce((acc, d) => {
      const dbId = pickDbId(d);
      if (!dbId) return acc;
      const sid = String(dbId);
      return currentIsOn(d, stateMap[sid]) === true ? acc + 1 : acc;
    }, 0);
  }, [items, stateMap]);

  const activeAutomations = useMemo(
    () =>
      Object.values(autoEnabled).filter(Boolean).length +
      customAutomations.filter((a) => a.enabled).length,
    [autoEnabled, customAutomations]
  );

  function toggleAutomation(key: AutomationKey) {
    setAutoEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const selectedDiscoveryIds = useMemo(
    () => Object.keys(selectedDiscover).filter((k) => selectedDiscover[k]),
    [selectedDiscover]
  );

  async function openAddDevice() {
    setAddDeviceOpen(true);
    setSelectedDiscover({});
    setErr(null);
    await refreshDiscovery();
  }

  async function refreshDiscovery() {
    setDiscovering(true);
    try {
      const found = await deviceService.discoverDevices();
      setDiscovered(Array.isArray(found) ? found : []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to discover devices");
      setDiscovered([]);
    } finally {
      setDiscovering(false);
    }
  }

  function toggleDiscoverySelection(id: string) {
    setSelectedDiscover((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function bindSelectedDevices() {
    if (!selectedDiscoveryIds.length) return;
    setBinding(true);
    setErr(null);
    try {
      const targets = discovered.filter((d) => {
        const ext = pickDiscoveryExternalId(d);
        return ext ? selectedDiscover[String(ext)] : false;
      });
      const payload: any = {
        devices: targets.map((d) => {
          const ext = pickDiscoveryExternalId(d);
          return {
            external_id: String(ext),
            vendor: d?.vendor || d?.adapter || "tuya",
            adapter: d?.adapter || d?.vendor || "tuya",
            name: d?.name || d?.type || "Device",
            type: d?.type || d?.category || "device",
            icon: d?.icon,
            ip: d?.ip,
            protocol: d?.protocol,
            online: typeof d?.online === "boolean" ? d.online : undefined,
            metadata: d?.metadata ?? d,
          };
        }),
        room: bindRoom || null,
        estate_id: estateId || undefined,
        home_id: homeId || undefined,
      };

      if (!payload.devices.length) {
        setErr("No valid discovered device IDs found.");
        return;
      }

      await deviceService.assignDevices(payload);
      setAddDeviceOpen(false);
      setBindRoom("");
      setSelectedDiscover({});
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to add selected devices");
    } finally {
      setBinding(false);
    }
  }

  function toggleSceneDevice(id: string) {
    setSceneDeviceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function createCustomScene() {
    const name = sceneName.trim();
    if (!name) {
      setErr("Scene name is required");
      return;
    }
    if (!sceneDeviceIds.length) {
      setErr("Select at least one device for the scene");
      return;
    }

    setCustomScenes((prev) => [
      {
        id: `custom_scene_${Date.now()}`,
        name,
        targetOn: sceneTargetOn,
        deviceIds: sceneDeviceIds,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setSceneName("");
    setSceneTargetOn(true);
    setSceneDeviceIds([]);
    setSceneFormOpen(false);
    setErr(null);
  }

  function createCustomAutomation() {
    const name = automationName.trim();
    if (!name) {
      setErr("Automation name is required");
      return;
    }
    if (!automationSceneId) {
      setErr("Select a scene to link this automation");
      return;
    }

    setCustomAutomations((prev) => [
      {
        id: `custom_auto_${Date.now()}`,
        name,
        schedule: automationSchedule.trim() || "Custom",
        sceneId: automationSceneId,
        enabled: true,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setAutomationName("");
    setAutomationSchedule("Every day • 7:00 PM");
    setAutomationSceneId("");
    setAutomationFormOpen(false);
    setErr(null);
  }

  function toggleCustomAutomation(id: string) {
    setCustomAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  }

  return (
    <ConsumerShell title="Devices" subtitle="Command Center" showBack backHref="/home">
      {/* command center hero */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-blue-700/20 p-5">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-cyan-100/80">Smart Home Command Center</div>
              <div className="mt-1 text-xl font-semibold text-white">Live Control Grid</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openAddDevice}
                className="rounded-2xl px-3 py-2 text-sm bg-cyan-300/20 text-cyan-100 border border-cyan-300/30 hover:bg-cyan-300/30 transition"
                type="button"
              >
                Add Device
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-2xl px-3 py-2 text-sm bg-white text-black hover:opacity-90 disabled:opacity-50 transition"
                type="button"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] text-white/50">Devices</div>
              <div className="text-lg font-semibold text-white">{items.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] text-white/50">Online</div>
              <div className="text-lg font-semibold text-emerald-300">{onlineCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] text-white/50">Active</div>
              <div className="text-lg font-semibold text-cyan-200">{onStateCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="text-[11px] text-white/50">Automations</div>
              <div className="text-lg font-semibold text-amber-200">{activeAutomations}</div>
            </div>
          </div>

          <div className="text-[11px] text-white/60">
            Live state sync:{" "}
            <span className="text-white/85">
              {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "Waiting for first sync"}
            </span>
          </div>
        </div>
      </div>

      {/* quick scenes */}
      <CameraIntelPanel estateId={estateId} />

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">Scenes</div>
            <div className="text-xs text-white/45">One-tap whole-home actions</div>
          </div>
          <button
            type="button"
            onClick={() => setSceneFormOpen((v) => !v)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 transition"
          >
            {sceneFormOpen ? "Close" : "Add Scene"}
          </button>
        </div>

        {sceneFormOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={sceneName}
                onChange={(e) => setSceneName(e.target.value)}
                placeholder="Scene name"
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              />
              <select
                value={sceneTargetOn ? "on" : "off"}
                onChange={(e) => setSceneTargetOn(e.target.value === "on")}
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="on">Action: Turn selected devices ON</option>
                <option value="off">Action: Turn selected devices OFF</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] text-white/50">Select devices for this scene</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-44 overflow-auto pr-1">
              {items
                .filter((d) => pickDbId(d))
                .map((d) => {
                  const sid = String(pickDbId(d));
                  const selected = sceneDeviceIds.includes(sid);
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => toggleSceneDevice(sid)}
                      className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                        selected
                          ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                          : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      <div className="font-semibold">{pickName(d)}</div>
                      <div className="text-white/45">{pickRoomName(d) || "Unassigned"}</div>
                    </button>
                  );
                })}
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={createCustomScene}
                className="rounded-xl bg-white text-black px-3 py-2 text-xs font-semibold hover:opacity-90"
              >
                Save Scene
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { key: "welcome_home", label: "Welcome", tint: "border-emerald-500/20 bg-emerald-500/10" },
            { key: "evening", label: "Evening", tint: "border-indigo-500/20 bg-indigo-500/10" },
            { key: "all_off", label: "All Off", tint: "border-white/15 bg-white/5" },
            { key: "away_mode", label: "Away Mode", tint: "border-amber-500/20 bg-amber-500/10" },
          ].map((scene) => (
            <button
              key={scene.key}
              type="button"
              onClick={() => runScene(scene.key as SceneKey)}
              disabled={sceneBusy !== null}
              className={`rounded-2xl border px-3 py-3 text-left transition hover:bg-white/10 disabled:opacity-60 ${scene.tint}`}
            >
              <div className="text-sm font-semibold text-white">{scene.label}</div>
              <div className="mt-1 text-[11px] text-white/55">
                {sceneBusy === scene.key ? "Running…" : "Apply now"}
              </div>
            </button>
          ))}
          {customScenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => runCustomScene(scene)}
              disabled={sceneBusy !== null}
              className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-3 text-left transition hover:bg-cyan-500/15 disabled:opacity-60"
            >
              <div className="text-sm font-semibold text-white">{scene.name}</div>
              <div className="mt-1 text-[11px] text-white/60">
                {scene.targetOn ? "Turn On" : "Turn Off"} • {scene.deviceIds.length} devices
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                {sceneBusy === scene.id ? "Running…" : "Apply now"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* automations */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">Automations</div>
            <div className="text-xs text-white/45">Local quick toggles for home routines</div>
          </div>
          <button
            type="button"
            onClick={() => setAutomationFormOpen((v) => !v)}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 transition"
          >
            {automationFormOpen ? "Close" : "Add Automation"}
          </button>
        </div>

        {automationFormOpen && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={automationName}
                onChange={(e) => setAutomationName(e.target.value)}
                placeholder="Automation name"
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              />
              <input
                value={automationSchedule}
                onChange={(e) => setAutomationSchedule(e.target.value)}
                placeholder="Schedule e.g. Every day • 7:00 PM"
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              />
              <select
                value={automationSceneId}
                onChange={(e) => setAutomationSceneId(e.target.value)}
                className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              >
                <option value="">Select scene</option>
                <option value="welcome_home">Welcome</option>
                <option value="evening">Evening</option>
                <option value="all_off">All Off</option>
                <option value="away_mode">Away Mode</option>
                {customScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={createCustomAutomation}
                className="rounded-xl bg-white text-black px-3 py-2 text-xs font-semibold hover:opacity-90"
              >
                Save Automation
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { key: "night_guard", title: "Night Guard", subtitle: "Keeps selected circuits active overnight" },
            { key: "energy_saver", title: "Energy Saver", subtitle: "Reduces idle power draw across rooms" },
            { key: "presence_watch", title: "Presence Watch", subtitle: "Auto-reacts when occupancy changes" },
          ].map((a) => {
            const enabled = autoEnabled[a.key as AutomationKey];
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => toggleAutomation(a.key as AutomationKey)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  enabled
                    ? "border-cyan-400/25 bg-cyan-500/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{a.title}</div>
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      enabled ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-white/20"
                    }`}
                  />
                </div>
                <div className="mt-1 text-[11px] text-white/55">{a.subtitle}</div>
              </button>
            );
          })}
          {customAutomations.map((a) => {
            const linkedCustom = customScenes.find((s) => s.id === a.sceneId);
            const linkedPreset =
              a.sceneId === "welcome_home"
                ? "Welcome"
                : a.sceneId === "evening"
                ? "Evening"
                : a.sceneId === "all_off"
                ? "All Off"
                : a.sceneId === "away_mode"
                ? "Away Mode"
                : null;
            const sceneLabel = linkedCustom?.name || linkedPreset || "Unknown Scene";

            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleCustomAutomation(a.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  a.enabled
                    ? "border-emerald-400/25 bg-emerald-500/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{a.name}</div>
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      a.enabled ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" : "bg-white/20"
                    }`}
                  />
                </div>
                <div className="mt-1 text-[11px] text-white/60">{a.schedule}</div>
                <div className="mt-1 text-[11px] text-white/45">Scene: {sceneLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* search / quick info */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, vendor, room, id…"
          className="
            w-full rounded-2xl
            bg-white/5 border border-white/10
            px-4 py-3
            text-sm text-white/90 placeholder:text-white/35
            outline-none focus:border-white/20
          "
        />

        <div className="mt-3 flex gap-2 overflow-auto pb-1">
          {[
            { key: "all", label: "All" },
            { key: "light", label: "Lights" },
            { key: "switch", label: "Switches" },
            { key: "hvac", label: "AC" },
            { key: "camera", label: "CCTV" },
            { key: "access", label: "Access" },
            { key: "sensor", label: "Sensors" },
            { key: "safety", label: "Safety" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFamilyFilter(f.key)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                familyFilter === f.key
                  ? "border-cyan-400/30 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              }`}
            >
              {f.label} • {familyCounts[f.key] ?? 0}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-white/45">
          <span>{filtered.length} device{filtered.length === 1 ? "" : "s"}</span>
          <span className="text-white/30">Tap card for controls • Tap power for full on/off</span>
        </div>
      </div>

      {err && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {addDeviceOpen && (
        <div className="fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAddDeviceOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 px-3 pb-[calc(12px+var(--sab))]">
            <div className="max-w-3xl mx-auto rounded-t-3xl border border-white/10 bg-zinc-950 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Add Home Devices</div>
                  <div className="text-[11px] text-white/45">Scan discoverable devices and bind to this home</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={refreshDiscovery}
                    disabled={discovering || binding}
                    className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/85 disabled:opacity-60"
                  >
                    {discovering ? "Scanning…" : "Scan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddDeviceOpen(false)}
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
                {discovering ? (
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Discovering devices…
                  </div>
                ) : discovered.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    No discoverable devices found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {discovered.map((d, idx) => {
                      const ext = pickDiscoveryExternalId(d);
                      const sid = ext ? String(ext) : `tmp-${idx}`;
                      const selected = ext ? !!selectedDiscover[String(ext)] : false;
                      return (
                        <label
                          key={sid}
                          className={`flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-3 py-2 ${
                            selected ? "bg-cyan-500/15" : "bg-white/5 hover:bg-white/10"
                          } ${ext ? "cursor-pointer" : "opacity-60"}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={!ext || binding}
                              onChange={() => ext && toggleDiscoverySelection(String(ext))}
                              className="accent-white"
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-white truncate">
                                {d?.name || d?.type || "Device"}
                              </div>
                              <div className="text-[11px] text-white/45 truncate">
                                {(d?.protocol || d?.adapter || d?.vendor || "device") + ` • id:${ext || "—"}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-[11px] text-white/45">
                            {typeof d?.online === "boolean" ? (d.online ? "Online" : "Offline") : d?.status || "Found"}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {selectedDiscoveryIds.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs text-white/60 mb-2">{selectedDiscoveryIds.length} selected</div>
                    <input
                      value={bindRoom}
                      onChange={(e) => setBindRoom(e.target.value)}
                      placeholder="Room name (optional)"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
                      disabled={binding}
                    />
                    <button
                      type="button"
                      onClick={bindSelectedDevices}
                      disabled={binding}
                      className="mt-2 w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-60"
                    >
                      {binding ? "Adding…" : "Add selected devices"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* grid */}
      {loading && filtered.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          Loading devices…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
          No devices found.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((d) => {
            const dbId = pickDbId(d);
            const sid = dbId ? String(dbId) : "";
            const name = pickName(d);
            const roomName = pickRoomName(d);
            const vendor = pickVendor(d);
            const online = isOnline(d);

            const cached = sid ? stateMap[sid] : {};
            const gangCount = guessGangCount(d, cached);
            const nowOn = currentIsOn(d, cached);

            const busy = sid && busyId === sid;

            return (
              <button
                key={sid || String(pickExternalId(d) || name)}
                type="button"
                onClick={() => openSheet(d)}
                className="
                  text-left rounded-3xl
                  border border-white/10
                  bg-white/5 hover:bg-white/8
                  transition
                  p-4
                  relative
                  overflow-hidden
                "
              >
                {/* top row: icon + power */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full ${statusDot(online)}`} />
                    <div className="text-[11px] text-white/45 truncate">{vendor}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMasterPower(d);
                    }}
                    disabled={busy}
                    className={`
                      h-9 w-9 rounded-full border
                      flex items-center justify-center
                      transition active:scale-[0.99]
                      ${powerButtonClass(nowOn)}
                      ${busy ? "opacity-60" : ""}
                    `}
                    aria-label="Power"
                    title="Power"
                  >
                    {/* power icon */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2v10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7.5 4.5C5 6.3 3.5 9 3.5 12c0 4.7 3.8 8.5 8.5 8.5S20.5 16.7 20.5 12c0-3-1.5-5.7-4-7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* name */}
                <div className="mt-3">
                  <div className="text-[14px] text-white/95 font-semibold leading-snug line-clamp-2">
                    {name}
                  </div>
                  <div className="mt-1 text-[12px] text-white/45 truncate">
                    {roomName || "Unassigned"}
                  </div>
                </div>

                {/* bottom hint */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-[11px] text-white/35">
                    {gangCount > 1 ? `${gangCount}-gang` : "1-gang"}
                  </div>

                  <div className="text-[11px] text-white/35">
                    {busy ? "Working…" : nowOn === null ? "No state" : nowOn ? "On" : "Off"}
                  </div>
                </div>

                {/* subtle background glow */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* BOTTOM SHEET (card tap) */}
      {sheetOpen && sheetDevice && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />

          <div className="absolute left-0 right-0 bottom-0 px-3 pb-[calc(12px+var(--sab))]">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-t-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                {/* grabber */}
                <div className="pt-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-white/15" />
                </div>

                {/* header */}
                <div className="px-4 pt-3 pb-4 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white truncate">
                      {pickName(sheetDevice)}
                    </div>
                    <div className="text-xs text-white/45 mt-1 truncate">
                      {pickRoomName(sheetDevice) || "Unassigned"} • {pickVendor(sheetDevice)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => viewState(sheetDevice)}
                      className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                    >
                      Details
                    </button>

                    <button
                      className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                      onClick={() => setSheetOpen(false)}
                      aria-label="Close"
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* controls */}
                <div className="p-4">
                  {(() => {
                    const dbId = pickDbId(sheetDevice);
                    const sid = dbId ? String(dbId) : "";
                    const cached = sid ? stateMap[sid] : {};
                    const gangCount = guessGangCount(sheetDevice, cached);
                    const ringValues = Object.keys(cached || {}).length
                      ? readGangValues(gangCount, cached)
                      : Array.from({ length: gangCount }, () => null);

                    const busy = sid && busyId === sid;
                    const online = isOnline(sheetDevice);

                    return (
                      <div className="grid gap-4">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 flex items-center justify-between">
                          <div className="text-sm text-white/75">
                            Controls
                            <div className="text-xs text-white/40 mt-1">
                              {gangCount > 1 ? `Switch groups: ${gangCount}` : "Switch"}
                            </div>
                          </div>

                          <GangRingSwitch
                            gangCount={gangCount}
                            online={online}
                            values={ringValues}
                            busy={busy}
                            onToggleGang={(gangIndex, next) => toggleGang(sheetDevice, gangIndex, next)}
                            size={64}
                          />
                        </div>

                        <div className="text-[11px] text-white/45">
                          Tip: Use the power button on the card for full on/off. Use rings here for per-gang control.
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* footer */}
                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Device:{" "}
                  <span className="text-white/70 font-mono">
                    {String(pickExternalId(sheetDevice) || "—")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {stateOpen && (
        <div className="fixed inset-0 z-[140]">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setStateOpen(false)} />
          <div className="absolute left-0 right-0 top-16 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{stateTitle}</div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                      {stateMeta?.vendor ? `${stateMeta.vendor} • ` : ""}Live state snapshot
                    </div>

                    {stateMeta?.external_id ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">External:</span>
                        <span className="text-[11px] text-white/70 font-mono truncate">{stateMeta.external_id}</span>
                        <button
                          onClick={() => copy(stateMeta.external_id)}
                          className="text-[11px] text-white/60 hover:text-white underline"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    ) : null}

                    {stateMeta?.id ? (
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-white/35">Device:</span>
                        <span className="text-[11px] text-white/70 font-mono truncate">{stateMeta.id}</span>
                        <button
                          onClick={() => copy(stateMeta.id)}
                          className="text-[11px] text-white/60 hover:text-white underline"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setStateOpen(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  {stateLoading ? (
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Fetching state…
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => copy(stateBody)}
                          className="rounded-2xl px-3 py-2 text-sm bg-white/10 text-white hover:bg-white/15 border border-white/10 transition"
                          type="button"
                        >
                          Copy JSON
                        </button>
                      </div>

                      <pre className="text-xs text-white/80 whitespace-pre-wrap break-words font-mono">
                        {stateBody}
                      </pre>
                    </>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-white/10 text-[11px] text-white/40">
                  Source: <span className="text-white/70">GET /devices/:deviceId/state</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
