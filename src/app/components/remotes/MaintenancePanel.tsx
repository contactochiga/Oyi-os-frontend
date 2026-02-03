// src/app/components/remotes/MaintenancePanel.tsx

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

function statusPill(status: Status) {
  switch (status) {
    case "resolved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "in_progress":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
    default:
      return "border-red-500/30 bg-red-500/10 text-red-200";
  }
}

function categoryPill(cat: Category) {
  switch (cat) {
    case "electricity":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200";
    case "water":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";
    case "security":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    case "device":
      return "border-purple-500/30 bg-purple-500/10 text-purple-200";
    default:
      return "border-zinc-500/30 bg-white/5 text-zinc-200";
  }
}

function formatTime(ts?: string) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // modal
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

      // ✅ support services that return { error }
      if (res?.error) throw new Error(res.error);

      // ✅ force array always
      setTickets(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setTickets([]); // ✅ prevents crashes in filter/map
      setErr(pickErr(e, "Failed to load maintenance requests."));
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

      // close + reset
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

  const openCount = useMemo(
    () => tickets.filter((t) => String(t.status || "open") === "open").length,
    [tickets]
  );
  const inProgressCount = useMemo(
    () => tickets.filter((t) => String(t.status || "") === "in_progress").length,
    [tickets]
  );
  const resolvedCount = useMemo(
    () => tickets.filter((t) => String(t.status || "") === "resolved").length,
    [tickets]
  );

  return (
    <RemotePanel title="Maintenance" lastUpdated={lastUpdated}>
      <div className="space-y-3">
        {/* mini header strip */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            {loading ? "Loading requests..." : "Your requests in this home/estate"}
          </div>

          <button
            onClick={loadTickets}
            disabled={loading}
            className={`text-xs px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition ${
              loading ? "opacity-60" : ""
            }`}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-zinc-400">Open</div>
            <div className="text-lg font-semibold text-white">{openCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-zinc-400">In progress</div>
            <div className="text-lg font-semibold text-white">{inProgressCount}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-[11px] text-zinc-400">Resolved</div>
            <div className="text-lg font-semibold text-white">{resolvedCount}</div>
          </div>
        </div>

        {/* error */}
        {err && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* tickets */}
        <div className="space-y-2">
          {!tickets.length && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              No maintenance requests yet. If anything breaks, report it and the control room will pick it up.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 hover:bg-zinc-900/80 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-semibold truncate">{t.title || "Maintenance request"}</div>

                    {t.description ? (
                      <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{t.description}</div>
                    ) : null}

                    <div className="text-[11px] text-zinc-500 mt-2">{formatTime(t.created_at)}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className={`text-[11px] px-2 py-1 rounded-full border ${statusPill(
                        (t.status as Status) || "open"
                      )}`}
                    >
                      {prettyStatus(((t.status as Status) || "open") as Status)}
                    </span>

                    <span
                      className={`text-[11px] px-2 py-1 rounded-full border ${categoryPill(
                        ((t.category as any) || "general") as Category
                      )}`}
                    >
                      {(t.category || "general").toString().toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setOpenModal(true)}
            className="flex-1 py-3 rounded-2xl bg-[#E11D2E] text-white text-sm font-semibold active:scale-[0.99] transition"
          >
            Report an Issue
          </button>

          <button
            onClick={() => {
              onInteraction?.();
              alert("Support: chat support flow coming next.");
            }}
            className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 active:scale-[0.99] transition"
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* create modal */}
      {openModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur"
            onClick={() => !creating && setOpenModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-white">New maintenance request</div>
                <div className="text-sm text-zinc-400 mt-1">The control room will receive this instantly.</div>
              </div>

              <button
                className="text-zinc-400 hover:text-zinc-200"
                onClick={() => !creating && setOpenModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-5">
              <input
                className="bg-zinc-900/60 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
                placeholder="Title (e.g. Water pump not working)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="bg-zinc-900/60 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
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
                  className="bg-zinc-900/60 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <textarea
                className="bg-zinc-900/60 border border-white/10 rounded-2xl px-4 py-3 outline-none text-white min-h-[110px]"
                placeholder="Describe what happened (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setOpenModal(false)}
                  disabled={creating}
                  className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  onClick={submit}
                  disabled={!canSubmit || creating}
                  className="flex-1 py-3 rounded-2xl bg-[#E11D2E] text-white font-semibold transition disabled:opacity-60"
                >
                  {creating ? "Submitting..." : "Submit"}
                </button>
              </div>

              <div className="text-[11px] text-zinc-500">
                Tip: Add accurate category so the right team picks it faster.
              </div>
            </div>
          </div>
        </div>
      )}
    </RemotePanel>
  );
}
