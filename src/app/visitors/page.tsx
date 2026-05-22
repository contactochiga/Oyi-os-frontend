"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import {
  visitorService,
  type VisitorAccess,
  type VisitorStatus,
} from "@/services/visitorService";

import {
  UserPlus,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Calendar,
  QrCode,
  Link as LinkIcon,
} from "lucide-react";

import { motion } from "framer-motion";

// -------------------------------
// helpers (prefixed to avoid collisions)
// -------------------------------
function vWhen(iso?: string | null) {
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

function vClampCount(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.floor(x);
}

function vMaskPhone(p?: string | null) {
  const s = String(p || "");
  if (s.length < 6) return s || "—";
  return `${s.slice(0, 3)}•••${s.slice(-2)}`;
}

function vInitialsFromName(name?: string | null) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "V";
  const a = parts[0]?.[0] || "V";
  const b = parts.length > 1 ? parts[1]?.[0] : "";
  return (a + b).toUpperCase();
}

function vStatusLabel(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "Approved";
  if (s === "active") return "Active";
  if (s === "entered") return "Checked-in";
  if (s === "exited") return "Checked-out";
  if (s === "denied") return "Rejected";
  if (s === "pending") return "Pending";
  return String(status || "—");
}

function vStatusTone(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();

  if (s === "approved" || s === "active")
    return {
      pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      icon: <CheckCircle className="h-4 w-4 text-emerald-200" />,
    };

  if (s === "entered")
    return {
      pill: "border-sky-500/20 bg-sky-500/10 text-sky-200",
      iconBg: "bg-sky-500/10 border-sky-500/20",
      icon: <CheckCircle className="h-4 w-4 text-sky-200" />,
    };

  if (s === "exited")
    return {
      pill: "border-white/10 bg-white/5 text-white/70",
      iconBg: "bg-white/5 border-white/10",
      icon: <Clock className="h-4 w-4 text-white/70" />,
    };

  if (s === "denied" || s === "rejected")
    return {
      pill: "border-red-500/20 bg-red-500/10 text-red-200",
      iconBg: "bg-red-500/10 border-red-500/20",
      icon: <XCircle className="h-4 w-4 text-red-200" />,
    };

  if (s === "pending")
    return {
      pill: "border-amber-500/20 bg-amber-500/10 text-amber-200",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      icon: <Clock className="h-4 w-4 text-amber-200" />,
    };

  return {
    pill: "border-white/10 bg-white/5 text-white/70",
    iconBg: "bg-white/5 border-white/10",
    icon: <User className="h-4 w-4 text-white/70" />,
  };
}

function vIsActiveStatus(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();
  return s === "active" || s === "entered" || s === "checked-in";
}

function vIsPendingStatus(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();
  return s === "pending";
}

function vIsApprovedStatus(status: VisitorStatus) {
  const s = String(status || "").toLowerCase();
  return s === "approved";
}

// -------------------------------
// tiny UI primitives (fit your dark theme)
// -------------------------------
function Card({ className = "", children }: { className?: string; children: any }) {
  return <div className={`rounded-2xl border border-white/10 bg-black/20 ${className}`}>{children}</div>;
}
function CardHeader({ className = "", children }: { className?: string; children: any }) {
  return <div className={`p-4 pb-3 border-b border-white/10 ${className}`}>{children}</div>;
}
function CardBody({ className = "", children }: { className?: string; children: any }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
function Pill({ className = "", children }: { className?: string; children: any }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${className}`}>
      {children}
    </span>
  );
}

// -------------------------------
// Page (ONLY ONE DEFAULT EXPORT)
// -------------------------------
export default function VisitorsPage() {
  // form (same logic)
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [mode, setMode] = useState<"code" | "link">("code");
  const [expiresHours, setExpiresHours] = useState<number>(6);

  const canCreate = useMemo(
    () => name.trim().length >= 2 && phone.trim().length >= 7,
    [name, phone]
  );

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

  // UI state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [tab, setTab] = useState<"all" | "pending" | "active">("all");

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

      setShowAddDialog(false);
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

  const activeVisitors = useMemo(
    () => items.filter((v) => vIsActiveStatus(v.status)),
    [items]
  );
  const pendingVisitors = useMemo(
    () => items.filter((v) => vIsPendingStatus(v.status)),
    [items]
  );
  const approvedVisitors = useMemo(
    () => items.filter((v) => vIsApprovedStatus(v.status)),
    [items]
  );

  const tabItems = useMemo(() => {
    if (tab === "pending") return pendingVisitors;
    if (tab === "active") return activeVisitors;
    return items;
  }, [tab, items, pendingVisitors, activeVisitors]);

  const sortedTabItems = useMemo(() => {
    return [...tabItems].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
  }, [tabItems]);

  const pendingCount = vClampCount(pendingVisitors.length);

  return (
    <ConsumerShell title="Visitor Access" subtitle="Access intelligence • trusted arrivals • gate flow">
      <div className="oyi-living-page space-y-3 pb-8">
      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <section className="oyi-environment-hero rounded-[24px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-sky-100/60">Access Intelligence</div>
            <h1 className="mt-1.5 text-xl font-semibold text-white">Gate flow is protected.</h1>
            <p className="mt-1.5 text-xs leading-5 text-white/50">Create passes, approve arrivals and keep visitor access quiet and traceable.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={loadMine}
            disabled={loading}
            className="rounded-full px-3 py-1.5 text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
            type="button"
          >
            {loading ? "Syncing" : "Refresh"}
          </button>

          <button
            onClick={() => setShowAddDialog(true)}
            className="rounded-full px-3 py-1.5 text-xs bg-white text-black font-medium hover:opacity-90 transition inline-flex items-center gap-2"
            type="button"
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardHeader className="border-b-0 pb-2">
            <div className="text-[12px] text-white/60">Active Visitors</div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="text-3xl font-bold text-white">{activeVisitors.length}</div>
            <div className="text-[11px] text-white/40 mt-1">Currently in estate</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="border-b-0 pb-2">
            <div className="text-[12px] text-white/60">Pending Approval</div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="text-3xl font-bold text-white">{pendingVisitors.length}</div>
            <div className="text-[11px] text-white/40 mt-1">Awaiting processing</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="border-b-0 pb-2">
            <div className="text-[12px] text-white/60">Pre-Approved</div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="text-3xl font-bold text-white">{approvedVisitors.length}</div>
            <div className="text-[11px] text-white/40 mt-1">Ready to check in</div>
          </CardBody>
        </Card>
      </div>

      {/* Created result */}
      {created && (
        <div className="mt-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-sm font-medium text-emerald-100">Access created</div>
          <div className="text-xs text-emerald-100/70 mt-1">
            Share the code/link with security or the visitor.
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-emerald-100/70 inline-flex items-center gap-2">
                  <QrCode className="h-3 w-3" />
                  Access code
                </div>
                <button
                  onClick={() => copy(created.code)}
                  className="text-[11px] text-emerald-100 underline"
                  type="button"
                >
                  Copy
                </button>
              </div>
              <div className="mt-1 text-sm text-white font-mono">{created.code || "—"}</div>
            </div>

            {created.link ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-black/20 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-emerald-100/70 inline-flex items-center gap-2">
                    <LinkIcon className="h-3 w-3" />
                    Access link
                  </div>
                  <button
                    onClick={() => copy(created.link)}
                    className="text-[11px] text-emerald-100 underline"
                    type="button"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-2 text-xs text-white/90 break-all">{created.link}</div>
              </div>
            ) : null}

            {created.qr ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-black/20 px-4 py-3">
                <div className="text-[11px] text-emerald-100/70 mb-2 inline-flex items-center gap-2">
                  <QrCode className="h-3 w-3" />
                  QR
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={created.qr}
                  alt="Visitor QR"
                  className="w-40 h-40 rounded-2xl border border-emerald-500/20 bg-black/30"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 rounded-[18px] border border-white/10 bg-white/[0.035] p-1">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`rounded-xl px-3 py-2 text-sm transition ${
            tab === "all" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`rounded-xl px-3 py-2 text-sm transition inline-flex items-center justify-center gap-2 ${
            tab === "pending" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
          }`}
        >
          Pending
          {pendingCount > 0 ? (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-white/10 border border-white/10 text-[11px] px-2 py-0.5">
              {pendingCount}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setTab("active")}
          className={`rounded-xl px-3 py-2 text-sm transition ${
            tab === "active" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
          }`}
        >
          Active
        </button>
      </div>

      {/* List */}
      <div>
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-white/60">
            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            Loading…
          </div>
        ) : sortedTabItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
            {tab === "pending"
              ? "No pending visitor requests."
              : tab === "active"
              ? "No active visitors in the estate."
              : "No visitors yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTabItems.slice(0, 50).map((v) => (
              <VisitorCard
                key={v.id}
                v={v}
                onOpen={() => openVisitorInfo(v.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Visitor Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-[130]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => (creating ? null : setShowAddDialog(false))}
          />
          <div className="absolute left-0 right-0 top-16 px-4">
            <div className="max-w-xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Register New Visitor</div>
                    <div className="text-xs text-white/40 mt-1">Submit a visitor access request</div>
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => (creating ? null : setShowAddDialog(false))}
                    aria-label="Close"
                    type="button"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-[12px] text-white/60 mb-2">Visitor Name *</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter visitor name"
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <div className="text-[12px] text-white/60 mb-2">Phone Number *</div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
                      disabled={creating}
                    />
                  </div>

                  <div>
                    <div className="text-[12px] text-white/60 mb-2">Purpose (optional)</div>
                    <input
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., Delivery, Personal visit"
                      className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/30 outline-none"
                      disabled={creating}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[12px] text-white/60 mb-2">Mode</div>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as any)}
                        className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                        disabled={creating}
                      >
                        <option value="code">Access Code</option>
                        <option value="link">Access Link</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-[12px] text-white/60 mb-2">Expires</div>
                      <select
                        value={expiresHours}
                        onChange={(e) => setExpiresHours(Number(e.target.value))}
                        className="w-full rounded-2xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white outline-none"
                        disabled={creating}
                      >
                        <option value={1}>1 hour</option>
                        <option value={3}>3 hours</option>
                        <option value={6}>6 hours</option>
                        <option value={12}>12 hours</option>
                        <option value={24}>24 hours</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setShowAddDialog(false)}
                      disabled={creating}
                      className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition disabled:opacity-50"
                      type="button"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={createVisitor}
                      disabled={!canCreate || creating}
                      className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition"
                      type="button"
                    >
                      {creating ? "Submitting…" : "Submit Request"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info modal */}
      {openInfo && (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpenInfo(false)}
          />
          <div className="absolute left-0 right-0 top-20 px-4">
            <div className="max-w-3xl mx-auto">
              <div className="rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">Visitor</div>
                    <div className="text-xs text-white/40 mt-1">Details & access info</div>
                  </div>

                  <button
                    className="rounded-xl px-2 py-1 text-white/70 hover:bg-white/5"
                    onClick={() => setOpenInfo(false)}
                    aria-label="Close"
                    type="button"
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
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {infoErr}
                    </div>
                  ) : infoItem ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Name</div>
                        <div className="text-sm text-white mt-1">{infoItem.visitor_name}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Phone</div>
                          <div className="text-sm text-white mt-1">{infoItem.visitor_phone}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Status</div>
                          <div className="text-sm text-white mt-1">{vStatusLabel(infoItem.status)}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Purpose</div>
                        <div className="text-sm text-white mt-1">{infoItem.purpose || "—"}</div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] text-white/40">Access code</div>
                        <div className="text-sm text-white mt-1 font-mono">{infoItem.access_code}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Created</div>
                          <div className="text-sm text-white mt-1">{vWhen(infoItem.created_at)}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-[11px] text-white/40">Expires</div>
                          <div className="text-sm text-white mt-1">{vWhen(infoItem.expires_at)}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => copy(infoItem.access_code)}
                          className="flex-1 py-3 rounded-2xl bg-white/10 text-white text-sm border border-white/10 hover:bg-white/15 transition"
                          type="button"
                        >
                          Copy code
                        </button>

                        <button
                          onClick={() => setOpenInfo(false)}
                          className="flex-1 py-3 rounded-2xl bg-white text-black text-sm font-medium hover:opacity-90 transition"
                          type="button"
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
      </div>
    </ConsumerShell>
  );
}

function VisitorCard({ v, onOpen }: { v: VisitorAccess; onOpen: () => void }) {
  const tone = vStatusTone(v.status);
  const initials = vInitialsFromName(v.visitor_name);

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onOpen}
      className="oyi-presence-row w-full text-left rounded-[20px] transition hover:bg-white/[0.055]"
      type="button"
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-9 w-9 rounded-[16px] border flex items-center justify-center ${tone.iconBg}`}>
              <span className="text-white font-semibold text-sm">{initials}</span>
            </div>

            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-white truncate">
                {v.visitor_name || "Visitor"}
              </div>

              <div className="text-xs text-white/45 mt-1 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {vMaskPhone(v.visitor_phone)}
                </span>

                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {vWhen(v.created_at)}
                </span>
              </div>
            </div>
          </div>

          <Pill className={tone.pill}>
            {tone.icon}
            {vStatusLabel(v.status)}
          </Pill>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/75">
            <span className="text-white/45">Code:</span>{" "}
            <span className="text-white font-mono">{v.access_code || "—"}</span>
            {v.expires_at ? (
              <span className="text-white/35"> • expires {vWhen(v.expires_at)}</span>
            ) : null}
          </div>

          <div className="rounded-[16px] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white/75">
            <span className="text-white/45">Purpose:</span>{" "}
            <span className="text-white/85">{v.purpose || "—"}</span>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-white/40">Tap to view full details →</div>
      </div>
    </motion.button>
  );
}
