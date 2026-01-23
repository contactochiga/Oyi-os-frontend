// src/app/components/remotes/VisitorPanel.tsx
"use client";

import { useMemo, useState } from "react";
import RemotePanel from "./RemotePanel";
import useAuth from "@/hooks/useAuth";

type VisitorDTO = {
  id: string;
  estate_id: string;
  resident_id: string;
  visitor_name: string;
  visitor_phone?: string | null;
  purpose?: string | null;
  house_id?: string | null;
  access_code: string;
  status: string; // pending|approved|entered|exited|denied (depends)
  expires_at?: string | null;
  verified_at?: string | null;
  qr_s3_url?: string | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "https://oyi-os.onrender.com";

async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export default function VisitorPanel({
  lastUpdated,
  onInteraction,
}: {
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const { user, token } = useAuth();

  const estateId = useMemo(
    () =>
      user?.estate_id ??
      (typeof window !== "undefined"
        ? localStorage.getItem("ochiga_estate")
        : null),
    [user?.estate_id]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // created visitor state
  const [created, setCreated] = useState<{
    id: string;
    link?: string;
    code?: string;
    qr?: string;
    status?: string;
    expiresAt?: string;
  } | null>(null);

  // verify state
  const [verifyCode, setVerifyCode] = useState("");
  const [verified, setVerified] = useState<VisitorDTO | null>(null);

  // create form state
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [purpose, setPurpose] = useState("");

  function touch() {
    onInteraction?.();
  }

  async function createVisitor() {
    if (!estateId) return setErr("No estate linked yet.");
    if (!visitorName.trim()) return setErr("Visitor name is required.");

    setLoading(true);
    setErr(null);
    try {
      const resp = await api<{
        id: string;
        link: string;
        code: string;
        qr: string;
        status: string;
        expiresAt: string;
      }>("/visitors", {
        method: "POST",
        token,
        body: JSON.stringify({
          estateId,
          visitorName: visitorName.trim(),
          visitorPhone: visitorPhone.trim() || null,
          purpose: purpose.trim() || null,
        }),
      });

      setCreated(resp);
      setVerified(null);
      setVerifyCode("");
      touch();
    } catch (e: any) {
      setErr(e?.message || "Failed to create visitor");
    } finally {
      setLoading(false);
    }
  }

  async function approveVisitor(id: string) {
    setLoading(true);
    setErr(null);
    try {
      const resp = await api<{ ok: true; visitor: VisitorDTO }>(
        `/visitors/approve/${id}`,
        { method: "PUT", token }
      );
      setVerified(resp.visitor);
      setCreated((c) => (c ? { ...c, status: resp.visitor.status } : c));
      touch();
    } catch (e: any) {
      setErr(e?.message || "Failed to approve visitor");
    } finally {
      setLoading(false);
    }
  }

  async function markEntry(id: string) {
    setLoading(true);
    setErr(null);
    try {
      await api(`/visitors/entry/${id}`, { method: "POST", token });
      // fetch latest info
      const info = await api<{ visitor: VisitorDTO }>(`/visitors/info/${id}`, {
        method: "GET",
        token,
      });
      setVerified(info.visitor);
      setCreated((c) => (c ? { ...c, status: info.visitor.status } : c));
      touch();
    } catch (e: any) {
      setErr(e?.message || "Failed to mark entry");
    } finally {
      setLoading(false);
    }
  }

  async function markExit(id: string) {
    setLoading(true);
    setErr(null);
    try {
      await api(`/visitors/exit/${id}`, { method: "POST", token });
      const info = await api<{ visitor: VisitorDTO }>(`/visitors/info/${id}`, {
        method: "GET",
        token,
      });
      setVerified(info.visitor);
      setCreated((c) => (c ? { ...c, status: info.visitor.status } : c));
      touch();
    } catch (e: any) {
      setErr(e?.message || "Failed to mark exit");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    if (!estateId) return setErr("No estate linked yet.");
    if (!verifyCode.trim()) return setErr("Enter an access code to verify.");

    setLoading(true);
    setErr(null);
    try {
      const resp = await api<{ valid: true; visitor: VisitorDTO }>(
        "/visitors/verify",
        {
          method: "POST",
          token,
          body: JSON.stringify({ code: verifyCode.trim(), estateId }),
        }
      );
      setVerified(resp.visitor);
      touch();
    } catch (e: any) {
      setVerified(null);
      setErr(e?.message || "Invalid access code");
    } finally {
      setLoading(false);
    }
  }

  const activeId = verified?.id || created?.id;

  return (
    <RemotePanel title="Visitor Access" lastUpdated={lastUpdated}>
      {err && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {!estateId && (
        <div className="text-sm text-gray-400">
          No estate linked yet. Please onboard/select an estate.
        </div>
      )}

      {!!estateId && (
        <div className="space-y-4">
          {/* CREATE VISITOR */}
          <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
            <div className="text-sm text-white font-medium mb-3">
              Create Visitor
            </div>

            <div className="space-y-2">
              <input
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Visitor name"
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
              />
              <input
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
              />
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Purpose (optional)"
                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
              />

              <button
                onClick={createVisitor}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#E11D2E] text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create Visitor"}
              </button>
            </div>

            {created && (
              <div className="mt-4 rounded-xl bg-gray-900 border border-gray-700 p-3">
                <div className="text-xs text-gray-400">Access Code</div>
                <div className="text-lg text-white font-semibold">
                  {created.code}
                </div>

                <div className="mt-2 text-xs text-gray-400">Status</div>
                <div className="text-sm text-white">{created.status}</div>

                {created.expiresAt && (
                  <div className="mt-2 text-xs text-gray-400">
                    Expires:{" "}
                    <span className="text-gray-200">
                      {new Date(created.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {created.link && (
                    <a
                      href={created.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-center py-2 rounded-lg bg-gray-800 text-xs text-white"
                    >
                      Open Link
                    </a>
                  )}
                  {created.qr && (
                    <a
                      href={created.qr}
                      target="_blank"
                      rel="noreferrer"
                      className="text-center py-2 rounded-lg bg-gray-800 text-xs text-white"
                    >
                      View QR
                    </a>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => approveVisitor(created.id)}
                    disabled={loading}
                    className="flex-1 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-medium disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      setErr(
                        "Deny is not implemented on backend yet. Add /visitors/deny/:id if you want this."
                      )
                    }
                    className="flex-1 py-2 rounded-lg bg-[#DC2626] text-white text-xs font-medium"
                  >
                    Deny
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* VERIFY VISITOR */}
          <div className="rounded-xl bg-gray-800 border border-gray-700 p-4">
            <div className="text-sm text-white font-medium mb-3">
              Verify Access Code
            </div>

            <div className="flex gap-2">
              <input
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="Enter code"
                className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
              />
              <button
                onClick={verify}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white disabled:opacity-50"
              >
                {loading ? "…" : "Verify"}
              </button>
            </div>

            {verified && (
              <div className="mt-4 rounded-xl bg-gray-900 border border-gray-700 p-3">
                <div className="text-sm text-white font-medium">
                  {verified.visitor_name}
                </div>
                <div className="text-xs text-gray-400">
                  Purpose: {verified.purpose || "—"}
                </div>
                <div className="text-xs text-gray-400">
                  Status:{" "}
                  <span className="text-gray-200">{verified.status}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => approveVisitor(verified.id)}
                    disabled={loading}
                    className="py-2 rounded-lg bg-[#16A34A] text-white text-xs font-medium disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => markEntry(verified.id)}
                    disabled={loading}
                    className="py-2 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Mark Entry
                  </button>
                  <button
                    onClick={() => markExit(verified.id)}
                    disabled={loading}
                    className="py-2 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Mark Exit
                  </button>
                  <button
                    onClick={() => setVerified(null)}
                    className="py-2 rounded-lg bg-gray-800 text-white text-xs font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {!verified && !activeId && (
              <div className="mt-3 text-xs text-gray-500">
                Verify a code to see visitor info.
              </div>
            )}
          </div>
        </div>
      )}
    </RemotePanel>
  );
}
