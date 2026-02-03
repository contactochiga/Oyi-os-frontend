// src/app/components/remotes/VisitorPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import { visitorService } from "@/services/visitorService";

type VisitorStatus = "active" | "approved" | "denied" | "entered" | "exited" | string;

type VisitorAccess = {
  id: string;
  visitor_name: string;
  visitor_phone: string;
  purpose?: string | null;
  access_code: string;
  status: VisitorStatus;
  created_at: string;
  expires_at?: string | null;
};

function when(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pill(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (s === "entered") return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  if (s === "exited") return "border-zinc-500/30 bg-white/5 text-zinc-200";
  if (s === "denied") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-yellow-500/30 bg-yellow-500/10 text-yellow-200"; // active/pending
}

function buildInviteMessage(args: {
  visitorName: string;
  estateName?: string;
  code?: string | null;
  link?: string | null;
  expiresAt?: string | null;
  note?: string | null;
}) {
  const lines: string[] = [];
  lines.push(`Hi ${args.visitorName}, you’ve been invited${args.estateName ? ` to ${args.estateName}` : ""}.`);
  if (args.code) lines.push(`Gate Code: ${args.code}`);
  if (args.link) lines.push(`Access Link: ${args.link}`);
  if (args.expiresAt) lines.push(`Expires: ${when(args.expiresAt)}`);
  if (args.note) lines.push(`Note: ${args.note}`);
  lines.push(`At the gate, show the code to security.`);
  return lines.join("\n");
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text);
}

export default function VisitorPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Minimal form (consumer)
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [note, setNote] = useState("");

  // created result
  const [created, setCreated] = useState<{
    visitor: VisitorAccess;
    link?: string | null;
    code?: string | null;
  } | null>(null);

  // minimal list
  const [items, setItems] = useState<VisitorAccess[]>([]);
  const canSubmit = visitorName.trim().length >= 2 && visitorPhone.trim().length >= 5;

  const estateName = useMemo(() => {
    if (typeof window === "undefined") return "";
    // optional: if you store estate name anywhere
    return localStorage.getItem("ochiga_estate_name") || "";
  }, []);

  async function loadMine() {
    // optional route; if not present it returns []
    const res = await visitorService.listMine();
    setItems(res || []);
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUpdated]);

  async function createVisitor() {
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);

    try {
      const resp = await visitorService.create({
        name: visitorName.trim(),
        phone: visitorPhone.trim(),
        purpose: note.trim() || undefined,
        navigation_mode: "code",
      });

      if ((resp as any)?.error) {
        setErr((resp as any).error);
        return;
      }

      const visitor = (resp as any).visitor as VisitorAccess;

      setCreated({
        visitor,
        link: (resp as any).link ?? null,
        code: (resp as any).code ?? visitor.access_code ?? null,
      });

      // optimistic add on top
      setItems((prev) => {
        const next = [visitor, ...prev];
        // de-dupe
        const map = new Map<string, VisitorAccess>();
        next.forEach((v) => map.set(v.id, v));
        return Array.from(map.values());
      });

      setVisitorName("");
      setVisitorPhone("");
      setNote("");

      onInteraction?.();
    } catch (e: any) {
      setErr(e?.message || "Failed to create visitor");
    } finally {
      setLoading(false);
    }
  }

  async function shareInvite() {
    if (!created) return;

    const msg = buildInviteMessage({
      visitorName: created.visitor.visitor_name,
      estateName: estateName || undefined,
      code: created.code,
      link: created.link,
      expiresAt: created.visitor.expires_at,
      note: created.visitor.purpose || null,
    });

    // Use native share sheet if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Visitor Access",
          text: msg,
        });
        return;
      } catch {
        // user cancelled share; ignore
      }
    }

    // fallback: copy
    await copy(msg);
    setErr("Invite copied. Paste to WhatsApp/SMS.");
  }

  async function copyCode() {
    if (!created?.code) return;
    await copy(created.code);
    setErr("Code copied.");
  }

  async function copyMessage() {
    if (!created) return;

    const msg = buildInviteMessage({
      visitorName: created.visitor.visitor_name,
      estateName: estateName || undefined,
      code: created.code,
      link: created.link,
      expiresAt: created.visitor.expires_at,
      note: created.visitor.purpose || null,
    });

    await copy(msg);
    setErr("Invite message copied.");
  }

  return (
    <RemotePanel title="Visitors" lastUpdated={lastUpdated}>
      <div className="space-y-3">
        {err && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Create visitor (minimal) */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Create visitor pass</div>
          <div className="text-xs text-zinc-400 mt-1">
            Enter name + phone. We’ll generate a gate code you can share.
          </div>

          <div className="grid gap-2 mt-3">
            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Visitor name"
              className="w-full rounded-2xl bg-zinc-900/60 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            />

            <input
              value={visitorPhone}
              onChange={(e) => setVisitorPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-2xl bg-zinc-900/60 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional) e.g. coming by 4pm"
              className="w-full rounded-2xl bg-zinc-900/60 border border-white/10 px-4 py-3 text-sm text-white outline-none"
            />

            <button
              onClick={createVisitor}
              disabled={!canSubmit || loading}
              className="w-full py-3 rounded-2xl bg-[#E11D2E] text-white text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create & Generate Code"}
            </button>
          </div>
        </div>

        {/* Created result */}
        {created && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-white font-semibold truncate">
                  {created.visitor.visitor_name}
                </div>
                <div className="text-xs text-zinc-400 mt-1 truncate">
                  {created.visitor.visitor_phone}
                  {created.visitor.purpose ? ` • ${created.visitor.purpose}` : ""}
                </div>
                <div className="text-[11px] text-zinc-500 mt-2">
                  Created: {when(created.visitor.created_at)}{" "}
                  {created.visitor.expires_at ? `• Expires: ${when(created.visitor.expires_at)}` : ""}
                </div>
              </div>

              <span
                className={`shrink-0 text-[11px] px-2 py-1 rounded-full border ${pill(created.visitor.status)}`}
              >
                {String(created.visitor.status || "active").replaceAll("_", " ")}
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] text-zinc-400">Gate code</div>
              <div className="mt-1 text-xl font-semibold text-white font-mono">
                {created.code || created.visitor.access_code}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={copyCode}
                className="py-2 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition"
              >
                Copy Code
              </button>

              <button
                onClick={copyMessage}
                className="py-2 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition"
              >
                Copy Invite
              </button>

              <button
                onClick={shareInvite}
                className="py-2 rounded-xl bg-[#E11D2E] text-white text-xs font-semibold hover:opacity-95 transition"
              >
                Share
              </button>
            </div>

            {created.link ? (
              <div className="mt-2 text-[11px] text-zinc-500 break-all">
                Link: <span className="text-zinc-300">{created.link}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Minimal list */}
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="text-sm font-semibold text-white">Recent visitors</div>
            <button
              onClick={loadMine}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition disabled:opacity-60"
            >
              Refresh
            </button>
          </div>

          {!items.length ? (
            <div className="p-4 text-sm text-zinc-300">
              No visitors yet. Create one and the code will appear here.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {items.slice(0, 10).map((v) => (
                <div key={v.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-semibold truncate">{v.visitor_name}</div>
                      <div className="text-xs text-zinc-400 truncate">{v.visitor_phone}</div>
                      <div className="text-[11px] text-zinc-500 mt-1">
                        {when(v.created_at)}
                        {v.expires_at ? ` • Expires ${when(v.expires_at)}` : ""}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`text-[11px] px-2 py-1 rounded-full border ${pill(v.status)}`}>
                        {String(v.status || "active").replaceAll("_", " ")}
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/90 font-mono">
                        {v.access_code || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-zinc-500">
          Gate verification (approve/deny/entry/exit) happens in the Facility app — not here.
        </div>
      </div>
    </RemotePanel>
  );
}
