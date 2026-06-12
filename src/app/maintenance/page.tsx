// src/app/maintenance/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "../components/ConsumerShell";
import { maintenanceService, type MaintenanceTicket } from "@/services/maintenanceService";

function pill(status?: string) {
  const s = String(status || "open").toLowerCase();
  const base = "inline-flex text-[11px] px-2 py-1 rounded-full border";

  if (s === "resolved") return `${base} bg-emerald-500/10 text-emerald-200 border-emerald-500/20`;
  if (s === "in_progress" || s === "in progress")
    return `${base} bg-amber-500/10 text-amber-200 border-amber-500/20`;
  return `${base} bg-white/5 text-white/70 border-white/10`;
}

function nice(s?: string) {
  const x = String(s || "open").replaceAll("_", " ");
  return x.charAt(0).toUpperCase() + x.slice(1);
}

function when(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
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

const QUICK_CATEGORIES = [
  ["Electrician", "electricity"],
  ["Plumber", "water"],
  ["HVAC", "hvac"],
  ["Carpenter", "carpentry"],
  ["Cleaner", "cleaning"],
  ["Gardener", "gardening"],
  ["Painter", "painting"],
  ["General", "general"],
] as const;

function progressIndex(status?: string) {
  const s = String(status || "open").toLowerCase();
  if (/resolved|completed|closed/.test(s)) return 3;
  if (/in_progress|in progress|working/.test(s)) return 2;
  if (/assigned|accepted/.test(s)) return 1;
  return 0;
}

function MaintenanceProgress({ status }: { status?: string }) {
  const active = progressIndex(status);
  const labels = ["Requested", "Assigned", "In Progress", "Completed"];
  return (
    <div className="mt-3">
      <div className="flex items-center">
        {labels.map((label, index) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <span className={`h-2.5 w-2.5 rounded-full border ${index <= active ? "border-sky-200 bg-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.52)]" : "border-white/18 bg-white/[0.04]"}`} />
            {index < labels.length - 1 ? <span className={`mx-1 h-px flex-1 ${index < active ? "bg-sky-300/60" : "bg-white/12"}`} /> : null}
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[10px] font-medium text-white/42">{labels[active]}</div>
    </div>
  );
}

export default function MaintenancePage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);

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
      const res: any = await maintenanceService.listMyTickets();
      if (res?.error) throw new Error(res.error);
      setTickets(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setTickets([]);
      setErr(pickErr(e, "Failed to load maintenance"));
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!form.title.trim()) return;

    setLoading(true);
    setErr(null);

    try {
      const created: any = await maintenanceService.createTicket({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        priority: form.priority,
      });

      if (created?.error) throw new Error(created.error);

      setShowNew(false);
      setForm({ title: "", description: "", category: "general", priority: "medium" });
      await load();
    } catch (e: any) {
      setErr(pickErr(e, "Failed to create request"));
    } finally {
      setLoading(false);
    }
  }

  function startQuickRequest(label: string, category: string) {
    setForm((current) => ({
      ...current,
      category,
      title: current.title || `${label} request`,
    }));
    setShowNew(true);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestId = String(params.get("requestId") || params.get("ticketId") || "").trim();
    if (!requestId || !tickets.length) return;
    const found = tickets.find((ticket) => String(ticket.id) === requestId);
    if (found) setSelectedTicket(found);
  }, [tickets]);

  return (
    <ConsumerShell
      title="Maintenance"
      subtitle="Service requests and scheduled care."
    >
      <div className="oyi-living-page space-y-3 pb-8">
      <section className="oyi-environment-hero rounded-[22px] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Home Service</div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.035em] text-white">{openCount ? `${openCount} active request${openCount === 1 ? "" : "s"}` : "Home service calm"}</div>
            <div className="mt-1 text-[11px] leading-4 text-white/46">Requests, technician updates and infrastructure issues stay organized here.</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-full px-3 py-1.5 text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
              type="button"
            >
              {loading ? "Syncing" : "Refresh"}
            </button>

            <button
              onClick={() => setShowNew(true)}
              className="rounded-full px-3 py-1.5 text-xs font-medium bg-white text-black hover:opacity-90 transition"
              type="button"
            >
              New
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}
      </section>

      <section className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK_CATEGORIES.map(([label, category]) => (
          <button key={category} type="button" onClick={() => startQuickRequest(label, category)} className="shrink-0 rounded-full border border-sky-300/14 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-100 transition active:scale-[0.98]">
            {label}
          </button>
        ))}
      </section>

      {/* Tickets list (cards, mobile-first) */}
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">Requests</div>
            <div className="text-xs text-white/40 mt-1">
              Latest first • facility updates stay resident-scoped
            </div>
          </div>
        </div>

        {!tickets.length && !loading ? (
          <div className="mt-3 rounded-[24px] border border-white/10 bg-white/[0.035] p-5 text-sm text-white/60">
            No requests yet. Maintenance, diagnostics and technician updates will appear here.
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTicket(t)}
                className="oyi-presence-row rounded-[20px] p-3.5 transition hover:bg-white/[0.055]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {t.title || "Maintenance request"}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {when(t.created_at)} •{" "}
                      <span className="text-white/60">
                        {t.category ? String(t.category).toUpperCase() : "—"}
                      </span>{" "}
                      •{" "}
                      <span className="text-white/60">
                        {t.priority ? String(t.priority).toUpperCase() : "—"}
                      </span>
                    </div>
                  </div>

                  <span className={pill(t.status)}>{nice(t.status)}</span>
                </div>

                {t.description ? (
                  <div className="mt-3 text-sm text-white/62 line-clamp-2">
                    {t.description}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/40">—</div>
                )}
                <MaintenanceProgress status={t.status} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create modal (composer style) */}
      {showNew && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !loading && setShowNew(false)}
          />

          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      New request
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Facility ops will be notified and you’ll get updates.
                    </div>
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => !loading && setShowNew(false)}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <input
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
                    placeholder="Title (e.g. Water leak in kitchen)"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />

                  <textarea
                    className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none min-h-[110px] resize-none"
                    placeholder="Describe the issue (optional)"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none"
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
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                      value={form.priority}
                      onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition disabled:opacity-50"
                      onClick={() => setShowNew(false)}
                      disabled={loading}
                      type="button"
                    >
                      Cancel
                    </button>

                    <button
                      className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                      onClick={create}
                      disabled={loading || !form.title.trim()}
                      type="button"
                    >
                      {loading ? "Submitting…" : "Submit"}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedTicket ? (
        <div className="fixed inset-0 z-[125]">
          <button type="button" aria-label="Close request details" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTicket(null)} />
          <section className="absolute inset-x-4 bottom-[calc(16px+var(--sab))] mx-auto max-w-xl rounded-[26px] border border-white/10 bg-zinc-950 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-sky-100/54">Maintenance request</div>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-[-0.04em] text-white">{selectedTicket.title || "Maintenance request"}</h2>
                <div className="mt-1 text-xs text-white/42">{when(selectedTicket.created_at)} · {selectedTicket.category ? String(selectedTicket.category).toUpperCase() : "GENERAL"}</div>
              </div>
              <span className={pill(selectedTicket.status)}>{nice(selectedTicket.status)}</span>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/62">{selectedTicket.description || "No description provided."}</p>
            <MaintenanceProgress status={selectedTicket.status} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-white/38">Priority</div><div className="mt-1 font-medium uppercase text-white/76">{selectedTicket.priority || "—"}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-white/38">Updated</div><div className="mt-1 font-medium text-white/76">{when((selectedTicket as any).updated_at || selectedTicket.created_at)}</div></div>
            </div>
            <button type="button" onClick={() => setSelectedTicket(null)} className="mt-4 h-11 w-full rounded-full bg-white text-sm font-semibold text-black">Close</button>
          </section>
        </div>
      ) : null}
      </div>
    </ConsumerShell>
  );
}
