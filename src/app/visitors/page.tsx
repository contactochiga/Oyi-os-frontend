"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import Button from "@/components/ui/Button"; // if you don't have this in consumer repo, replace with <button> (see note below)
import {
  visitorService,
  type VisitorAccess,
  type VisitorStatus,
} from "@/services/visitorService";

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pill(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();
  const base =
    "text-[11px] px-2 py-1 rounded-full border inline-flex items-center";

  if (s === "approved" || s === "active")
    return `${base} border-emerald-500/20 bg-emerald-500/10 text-emerald-200`;
  if (s === "denied")
    return `${base} border-red-500/20 bg-red-500/10 text-red-200`;
  if (s === "entered")
    return `${base} border-blue-500/20 bg-blue-500/10 text-blue-200`;
  if (s === "exited")
    return `${base} border-white/10 bg-white/5 text-white/70`;

  return `${base} border-white/10 bg-white/5 text-white/70`;
}

function maskPhone(p?: string | null) {
  const s = String(p || "");
  if (s.length < 6) return s || "—";
  return `${s.slice(0, 3)}•••${s.slice(-2)}`;
}

export default function VisitorsPage() {
  // form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [mode, setMode] = useState<"code" | "link">("code");
  const [expiresHours, setExpiresHours] = useState<number>(6);

  const canCreate = useMemo(() => {
    return name.trim().length >= 2 && phone.trim().length >= 7;
  }, [name, phone]);

  // create response
  const [created, setCreated] = useState<{
    id?: string;
    code?: string | null;
    link?: string | null;
    qr?: string | null;
  } | null>(null);

  // list
  const [items, setItems] = useState<VisitorAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // details modal
  const [openInfo, setOpenInfo] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const [infoItem, setInfoItem] = useState<VisitorAccess | null>(null);

  async function loadMine() {
    setLoading(true);
    setErr(null);
    try {
      const list = await visitorService.listMine();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to load visitors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMine();
  }, []);

  async function createVisitor() {
    if (!canCreate) return;

    setCreating(true);
    setErr(null);
    setCreated(null);

    try {
      const res: any = await visitorService.create({
        name: name.trim(),
        phone: phone.trim(),
        purpose: purpose.trim() || undefined,
        navigation_mode: mode,
        expires_hours: Number.isFinite(expiresHours) ? expiresHours : undefined,
      });

      if (res?.error) {
        setErr(String(res.error));
        return;
      }

      const v: VisitorAccess | undefined = res?.visitor;
      setCreated({
        id: v?.id,
        code: res?.code ?? v?.access_code ?? null,
        link: res?.link ?? null,
        qr: res?.qr ?? null,
      });

      // reset form lightly (keep mode/expiry)
      setName("");
      setPhone("");
      setPurpose("");

      // refresh list
      await loadMine();
    } catch (e: any) {
      setErr(e?.message || "Failed to create visitor");
    } finally {
      setCreating(false);
    }
  }

  async function openVisitorInfo(id: string) {
    setOpenInfo(true);
    setInfoLoading(true);
    setInfoErr(null);
    setInfoItem(null);

    try {
      const res: any = await visitorService.getInfo(id);
      if (res?.error) {
        setInfoErr(String(res.error));
        return;
      }
      setInfoItem(res?.visitor || null);
    } catch (e: any) {
      setInfoErr(e?.message || "Failed to load visitor info");
    } finally {
      setInfoLoading(false);
    }
  }

  function copy(text?: string | null) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <ConsumerShell title="Visitors" subtitle="Create access • track entries">
      {/* CREATE PANEL */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-semibold text-white">Create visitor access</div>
        <div className="text-xs text-white/40 mt-1">
          Generate a code (or link) for gate entry.
        </div>

        <div className="mt-4 grid gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Visitor name (e.g. James)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
          />

          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone (e.g. 08012345678)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
          />

          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Purpose (optional)"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="code">Access Code</option>
              <option value="link">Access Link</option>
            </select>

            <select
              value={expiresHours}
              onChange={(e) => setExpiresHours(Number(e.target.value))}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              <option value={1}>1 hour</option>
              <option value={3}>3 hours</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createVisitor}
              disabled={!canCreate || creating}
              className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Access"}
            </button>

            <button
              onClick={loadMine}
              disabled={loading}
              className="px-4 py-3 rounded-xl bg-white/10 text-white text-sm disabled:opacity-50"
            >
              {loading ? "..." : "Refresh"}
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* CREATED RESULT */}
        {created && (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
            <div className="text-sm text-emerald-200 font-semibold">
              Visitor access created
            </div>

            <div className="mt-2 grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-emerald-100/80">Code</div>
                <button
                  onClick={() => copy(created.code)}
                  className="text-xs text-emerald-200 underline"
                >
                  Copy
                </button>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-black/20 px-3 py-2 text-sm text-white font-mono">
                {created.code || "—"}
              </div>

              {created.link ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-emerald-100/80">Link</div>
                    <button
                      onClick={() => copy(created.link)}
                      className="text-xs text-emerald-200 underline"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-black/20 px-3 py-2 text-xs text-white break-all">
                    {created.link}
                  </div>
                </div>
              ) : null}

              {created.qr ? (
                <div className="mt-3">
                  <div className="text-xs text-emerald-100/80 mb-2">QR</div>
                  {/* If backend returns base64 dataUrl or url, show it */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={created.qr}
                    alt="Visitor QR"
                    className="w-40 h-40 rounded-xl border border-emerald-500/20 bg-black/30"
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* LIST */}
      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Recent visitors</div>
            <div className="text-xs text-white/40 mt-1">
              This uses <span className="text-white/70">GET /visitors/mine</span>{" "}
              (safe if not enabled).
            </div>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No visitors yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {items.slice(0, 30).map((v) => (
              <button
                key={v.id}
                onClick={() => openVisitorInfo(v.id)}
                className="w-full text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white font-semibold truncate">
                      {v.visitor_name || "Visitor"}
                    </div>
                    <div className="text-xs text-white/40 mt-1 truncate">
                      {maskPhone(v.visitor_phone)} • {when(v.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={pill(v.status)}>{String(v.status)}</span>
                    <span className="text-xs text-white/40">Open →</span>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                  Code: <span className="text-white font-mono">{v.access_code}</span>
                  {v.expires_at ? (
                    <span className="text-white/40">
                      {" "}
                      • expires {when(v.expires_at)}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* INFO MODAL */}
      {openInfo && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpenInfo(false)}
          />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      Visitor details
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      GET /visitors/info/:id
                    </div>
                  </div>

                  <button
                    className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setOpenInfo(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4">
                  {infoLoading ? (
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Loading…
                    </div>
                  ) : infoErr ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {infoErr}
                    </div>
                  ) : infoItem ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Name</div>
                        <div className="text-sm text-white mt-1">
                          {infoItem.visitor_name}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Phone</div>
                          <div className="text-sm text-white mt-1">
                            {infoItem.visitor_phone}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Status</div>
                          <div className="text-sm text-white mt-1">
                            {String(infoItem.status)}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Purpose</div>
                        <div className="text-sm text-white mt-1">
                          {infoItem.purpose || "—"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Access code</div>
                        <div className="text-sm text-white mt-1 font-mono">
                          {infoItem.access_code}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Created</div>
                          <div className="text-sm text-white mt-1">
                            {when(infoItem.created_at)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Expires</div>
                          <div className="text-sm text-white mt-1">
                            {when(infoItem.expires_at)}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copy(infoItem.access_code)}
                          className="flex-1 py-3 rounded-xl bg-white/10 text-white text-sm"
                        >
                          Copy Code
                        </button>

                        <button
                          onClick={() => setOpenInfo(false)}
                          className="flex-1 py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-semibold"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/60">—</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
