"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "../components/ConsumerShell";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";

function pill(status?: string) {
  const s = String(status || "open").toLowerCase();
  if (s === "resolved") return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
  if (s === "in_progress" || s === "in progress")
    return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20";
  return "bg-red-500/15 text-red-200 border-red-500/20";
}

function nice(s?: string) {
  const x = String(s || "open").replaceAll("_", " ");
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function MaintenancePage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    priority: "medium",
  });

  const openCount = useMemo(
    () => tickets.filter((t) => String(t.status || "open").toLowerCase() !== "resolved").length,
    [tickets]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const list = await maintenanceService.listMyTickets();
      setTickets(list || []);
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!form.title.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      await maintenanceService.createTicket({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        priority: form.priority,
      });
      setShowNew(false);
      setForm({ title: "", description: "", category: "general", priority: "medium" });
      await load();
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ConsumerShell
      title="Maintenance"
      subtitle="Service desk & request history"
      showBack
      backHref="/home"
    >
      {/* Top actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="text-white/70 text-sm">
          Open requests: <span className="text-white font-semibold">{openCount}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold"
          >
            New Request
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200 mb-4">
          {err}
        </div>
      )}

      {/* Sweet table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] text-white/60 border-b border-white/10">
          <div className="col-span-5">Issue</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-1">Priority</div>
          <div className="col-span-2">Created</div>
        </div>

        {!tickets.length && !loading ? (
          <div className="p-5 text-sm text-white/70">
            No requests yet. Create one — it will appear here and also reflect on Facility Overview (open maintenance).
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 hover:bg-white/[0.06] transition"
            >
              <div className="col-span-5 min-w-0">
                <div className="text-white text-sm font-semibold truncate">
                  {t.title || "Maintenance request"}
                </div>
                {t.description ? (
                  <div className="text-white/60 text-xs mt-1 line-clamp-1">{t.description}</div>
                ) : (
                  <div className="text-white/40 text-xs mt-1">—</div>
                )}
              </div>

              <div className="col-span-2">
                <span className={`inline-flex text-[11px] px-2 py-1 rounded-full border ${pill(t.status)}`}>
                  {nice(t.status)}
                </span>
              </div>

              <div className="col-span-2 text-white/80 text-sm">
                {t.category ? String(t.category).toUpperCase() : "—"}
              </div>

              <div className="col-span-1 text-white/80 text-sm">
                {t.priority ? String(t.priority).toUpperCase() : "—"}
              </div>

              <div className="col-span-2 text-white/60 text-xs">{when(t.created_at)}</div>
            </div>
          ))
        )}
      </div>

      {/* Create modal */}
      {showNew && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => !loading && setShowNew(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/10 p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-white font-semibold">New Maintenance Request</div>
                <div className="text-xs text-white/60 mt-1">
                  This will notify estate facility ops and you’ll get updates.
                </div>
              </div>
              <button className="text-white/60 hover:text-white" onClick={() => !loading && setShowNew(false)}>
                ✕
              </button>
            </div>

            <div className="grid gap-3 mt-4">
              <input
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                placeholder="Title (e.g. Water leak in kitchen)"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />

              <textarea
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none min-h-[96px]"
                placeholder="Describe the issue (optional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                >
                  <option value="general">General</option>
                  <option value="electricity">Electricity</option>
                  <option value="water">Water</option>
                  <option value="security">Security</option>
                  <option value="device">Device</option>
                </select>

                <select
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white"
                  onClick={() => setShowNew(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white font-semibold"
                  onClick={create}
                  disabled={loading || !form.title.trim()}
                >
                  {loading ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
