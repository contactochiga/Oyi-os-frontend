"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";

type Category = "electricity" | "water" | "security" | "device" | "general";
type Status = "open" | "in_progress" | "resolved";

function prettyStatus(s: Status) {
  if (s === "in_progress") return "In progress";
  if (s === "resolved") return "Resolved";
  return "Open";
}

function pill(status: Status) {
  if (status === "resolved") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (status === "in_progress") return "border-yellow-500/20 bg-yellow-500/10 text-yellow-200";
  return "border-red-500/20 bg-red-500/10 text-red-200";
}

function formatTime(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pickErr(e: any, fallback: string) {
  return e?.response?.data?.error || e?.response?.data?.message || e?.message || fallback;
}

export default function MaintenancePanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [openModal, setOpenModal] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("general");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");

  const canSubmit = title.trim().length >= 3;

  async function loadTickets() {
    setErr(null);
    setLoading(true);
    try {
      const res: any = await maintenanceService.listMyTickets();
      if (res?.error) throw new Error(res.error);
      setTickets(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setTickets([]);
      setErr(pickErr(e, "Failed to load maintenance."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  async function submit() {
    if (!canSubmit) return;

    setCreating(true);
    setErr(null);

    try {
      const created: any = await maintenanceService.createTicket({
        title: title.trim(),
        category,
        priority,
        description: description.trim() || undefined,
      });

      if (created?.error) throw new Error(created.error);

      setOpenModal(false);
      setTitle("");
      setCategory("general");
      setPriority("medium");
      setDescription("");

      await loadTickets();
      onInteraction?.();
    } catch (e: any) {
      setErr(pickErr(e, "Failed to create request."));
    } finally {
      setCreating(false);
    }
  }

  const counts = useMemo(() => {
    const open = tickets.filter((t) => String(t.status || "open") === "open").length;
    const prog = tickets.filter((t) => String(t.status || "") === "in_progress").length;
    const res = tickets.filter((t) => String(t.status || "") === "resolved").length;
    return { open, prog, res };
  }, [tickets]);

  return (
    <RemotePanel
      title="Maintenance"
      lastUpdated={lastUpdated}
      right={
        <button
          onClick={loadTickets}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 border border-white/10 disabled:opacity-50"
          type="button"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-white/45">Open</div>
            <div className="text-[15px] font-semibold text-white/90">{counts.open}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-white/45">In progress</div>
            <div className="text-[15px] font-semibold text-white/90">{counts.prog}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-white/45">Resolved</div>
            <div className="text-[15px] font-semibold text-white/90">{counts.res}</div>
          </div>
        </div>

        {err && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        )}

        {!tickets.length && !loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.slice(0, 6).map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white/90 truncate">
                      {t.title || "Maintenance request"}
                    </div>
                    {t.description ? (
                      <div className="mt-1 text-[12px] text-white/60 line-clamp-2">
                        {t.description}
                      </div>
                    ) : null}
                    <div className="mt-2 text-[11px] text-white/40">{formatTime(t.created_at)}</div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${pill(((t.status as any) || "open") as Status)}`}>
                      {prettyStatus(((t.status as any) || "open") as Status)}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {(t.priority || "medium").toString().toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setOpenModal(true)}
          className="w-full py-3 rounded-2xl bg-white text-black text-sm font-semibold border border-white/20"
          type="button"
        >
          New request
        </button>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur"
            onClick={() => !creating && setOpenModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-white font-semibold text-lg">New request</div>
                <div className="text-white/45 text-sm mt-1">Describe the issue clearly.</div>
              </div>
              <button
                className="text-white/60 hover:text-white"
                onClick={() => !creating && setOpenModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
                placeholder="Title (required)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="general">General</option>
                  <option value="electricity">Electricity</option>
                  <option value="water">Water</option>
                  <option value="security">Security</option>
                  <option value="device">Device</option>
                </select>

                <select
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <textarea
                className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white min-h-[110px]"
                placeholder="Details (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setOpenModal(false)}
                  disabled={creating}
                  className="flex-1 py-3 rounded-2xl bg-white/10 text-white border border-white/10 hover:bg-white/15 disabled:opacity-60"
                  type="button"
                >
                  Cancel
                </button>

                <button
                  onClick={submit}
                  disabled={!canSubmit || creating}
                  className="flex-1 py-3 rounded-2xl bg-white text-black font-semibold border border-white/20 disabled:opacity-60"
                  type="button"
                >
                  {creating ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RemotePanel>
  );
}
