"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Home, Plus, RefreshCw, Shield, Sparkles, Thermometer, Zap } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { roomsService, RoomDTO } from "@/services/roomsService";
import ConsumerShell from "@/app/components/ConsumerShell";

type RoomStatus = "active" | "idle" | "automated";

function inferStatus(room: RoomDTO): RoomStatus {
  const n = Array.isArray(room.devices) ? room.devices.length : 0;
  if (n >= 4) return "active";
  if (n >= 2) return "automated";
  return "idle";
}

function statusCopy(status: RoomStatus) {
  if (status === "active") return "Awake";
  if (status === "automated") return "Automated";
  return "Quiet";
}

function statusTone(status: RoomStatus) {
  if (status === "active") return "bg-emerald-300 shadow-[0_0_16px_rgba(95,227,161,0.65)]";
  if (status === "automated") return "bg-sky-300 shadow-[0_0_16px_rgba(74,168,255,0.65)]";
  return "bg-white/35";
}

function fallbackIcon(index: number) {
  const icons = [Home, Thermometer, Shield, Zap, Sparkles];
  return icons[index % icons.length];
}

export default function RoomsClient() {
  const router = useRouter();
  const { user } = useAuth();

  const estateId = useMemo(
    () => user?.estate_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_estate") : null),
    [user?.estate_id]
  );

  const homeId = useMemo(
    () => (user as any)?.home_id ?? (typeof window !== "undefined" ? localStorage.getItem("ochiga_home") : null),
    [user]
  );

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadRooms() {
    if (!homeId) return;
    setLoading(true);
    setErr(null);
    try {
      const list = await roomsService.getRooms(homeId);
      setRooms(list || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load spaces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!homeId) return;
    loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeId]);

  async function createRoom() {
    if (!estateId) return setErr("No estate context found for this user.");
    if (!homeId) return setErr("No home context found for this user.");

    const name = window.prompt("Space name, for example Living Room or Bedroom");
    if (!name) return;

    setLoading(true);
    setErr(null);
    try {
      await roomsService.createRoom({ estate_id: estateId, home_id: homeId, name, type: null, ai_profile: null });
      await loadRooms();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to create space");
    } finally {
      setLoading(false);
    }
  }

  const totalDevices = rooms.reduce((sum, room) => sum + (Array.isArray(room.devices) ? room.devices.length : 0), 0);

  return (
    <ConsumerShell title="Spaces" subtitle="Move through your home as an intelligent environment, not a device list.">
      <div className="space-y-4 pb-8">
        <section className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Spatial Layer</div>
              <h1 className="mt-2 text-2xl font-semibold text-white">{rooms.length || "No"} connected space{rooms.length === 1 ? "" : "s"}</h1>
              <p className="mt-2 text-sm leading-6 text-white/55">
                {totalDevices ? `${totalDevices} device signals are mapped into this home.` : "Add spaces and bind devices when the home is ready."}
              </p>
            </div>
            <div className="oyi-orb h-16 w-16 shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={loadRooms} disabled={loading || !homeId} className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/75 transition hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className="mr-2 inline h-4 w-4" /> {loading ? "Syncing" : "Refresh"}
            </button>
            <button type="button" onClick={createRoom} disabled={loading || !homeId} className="rounded-full border border-sky-300/20 bg-sky-300/12 px-4 py-2 text-sm font-medium text-sky-50 transition hover:bg-sky-300/18 disabled:opacity-50">
              <Plus className="mr-2 inline h-4 w-4" /> Add Space
            </button>
          </div>
        </section>

        {err ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</div> : null}
        {!homeId ? <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-white/60">No home selected yet. Join or choose a home to view spaces.</div> : null}

        {loading ? <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55">Oyi is syncing spatial state…</div> : null}

        <section className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room, index) => {
            const devicesCount = Array.isArray(room.devices) ? room.devices.length : 0;
            const status = inferStatus(room);
            const Icon = fallbackIcon(index);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => router.push(`/room?roomId=${room.id}`)}
                className="min-h-[164px] rounded-[28px] border border-white/10 bg-black/22 p-4 text-left transition hover:bg-white/[0.065] active:scale-[0.99]"
              >
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06] text-sky-100"><Icon className="h-5 w-5" /></span>
                      <span className={`h-2.5 w-2.5 rounded-full ${statusTone(status)}`} />
                    </div>
                    <h2 className="mt-4 truncate text-lg font-semibold text-white">{room.name || "Unnamed Space"}</h2>
                    <p className="mt-2 text-sm leading-5 text-white/48">{statusCopy(status)} · {devicesCount} device signal{devicesCount === 1 ? "" : "s"}</p>
                  </div>
                  <div className="mt-4 text-xs text-white/35">Open spatial controls →</div>
                </div>
              </button>
            );
          })}
        </section>

        {!loading && rooms.length === 0 && homeId ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center">
            <div className="mx-auto oyi-orb h-16 w-16" aria-hidden="true" />
            <h2 className="mt-5 text-lg font-semibold text-white">No spaces mapped yet.</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">Start by adding the first room. Oyi will use spaces to understand context before showing controls.</p>
          </div>
        ) : null}
      </div>
    </ConsumerShell>
  );
}
