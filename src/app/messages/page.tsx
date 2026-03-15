"use client";

import { useEffect, useMemo, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import messagesService, {
  ChatMessage,
  ChatResident,
  InboxThread,
} from "@/services/messagesService";
import { FiChevronLeft, FiEdit2, FiRefreshCw, FiSearch, FiSend } from "react-icons/fi";

function displayName(r?: ChatResident | null) {
  if (!r) return "Resident";
  return r.full_name || r.username || "Resident";
}

function initials(r?: ChatResident | null) {
  const d = displayName(r).trim();
  return (d.charAt(0) || "R").toUpperCase();
}

function shortTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function presenceLabel(r?: ChatResident | null) {
  if (!r) return "Offline";
  if (r.is_online) return "Online";
  if (r.last_seen_at) return `Seen ${shortTime(r.last_seen_at)}`;
  return "Offline";
}

export default function MessagesPage() {
  const { user } = useAuth();
  const myId = useMemo(() => String((user as any)?.id || ""), [user]);

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [residents, setResidents] = useState<ChatResident[]>([]);
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [listQuery, setListQuery] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [compose, setCompose] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function loadInbox() {
    const list = await messagesService.listInbox();
    setThreads(Array.isArray(list) ? list : []);
  }

  async function loadResidents(q = "") {
    const list = await messagesService.listResidents(q);
    setResidents(Array.isArray(list) ? list : []);
  }

  async function loadThreadMessages(thread: InboxThread | null) {
    if (!thread?.id) {
      setMessages([]);
      return;
    }
    const list = await messagesService.listMessages(thread.id, undefined, 80);
    setMessages(Array.isArray(list) ? list : []);
    await messagesService.markRead(thread.id);
    await loadInbox();
  }

  async function openThreadFromResident(peerId: string) {
    if (!peerId) return;
    setErr(null);
    const res: any = await messagesService.createOrGetDirectThread(peerId);
    if (res?.error) {
      setErr(String(res.error));
      return;
    }
    await loadInbox();
    const inbox = await messagesService.listInbox();
    setThreads(Array.isArray(inbox) ? inbox : []);
    const found = (inbox || []).find((t) => String(t.id) === String(res?.thread?.id));
    if (found) {
      setActiveThread(found);
      setView("chat");
    }
    setShowPeople(false);
  }

  async function boot() {
    setLoading(true);
    setErr(null);
    try {
      await Promise.all([loadInbox(), loadResidents()]);
    } catch (e: any) {
      setErr(e?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    boot();
    const t = window.setInterval(() => {
      loadInbox();
      if (activeThread?.id) loadThreadMessages(activeThread);
    }, 12000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThread?.id) return;
    void loadThreadMessages(activeThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id]);

  const filteredThreads = useMemo(() => {
    const t = listQuery.trim().toLowerCase();
    if (!t) return threads;
    return threads.filter((th) => {
      const s = `${displayName(th.peer)} ${th.last_message?.body || ""}`.toLowerCase();
      return s.includes(t);
    });
  }, [threads, listQuery]);

  const filteredResidents = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter((r) => `${r.full_name || ""} ${r.username || ""}`.toLowerCase().includes(q));
  }, [residents, peopleQuery]);

  async function send() {
    if (!activeThread?.id) return;
    const text = compose.trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    const res: any = await messagesService.sendMessage(activeThread.id, text);
    setSending(false);
    if (res?.error) {
      setErr(String(res.error));
      return;
    }
    setCompose("");
    await loadThreadMessages(activeThread);
  }

  return (
    <ConsumerShell title="Messages" subtitle="Direct messages">
      {err ? (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      {view === "list" ? (
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <FiSearch className="text-white/45" />
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Search messages"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
              <button
                type="button"
                onClick={() => setShowPeople((v) => !v)}
                className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-white/85"
                title="New message"
              >
                <FiEdit2 />
              </button>
              <button
                type="button"
                onClick={() => void boot()}
                className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-2 text-white/85"
                title="Refresh"
              >
                <FiRefreshCw />
              </button>
            </div>

            {showPeople ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-2">
                <div className="flex items-center gap-2 px-2">
                  <FiSearch className="text-white/45" />
                  <input
                    value={peopleQuery}
                    onChange={(e) => {
                      setPeopleQuery(e.target.value);
                      void loadResidents(e.target.value);
                    }}
                    placeholder="Find resident"
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                  />
                </div>
                <div className="mt-2 max-h-44 overflow-auto space-y-1">
                  {filteredResidents.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void openThreadFromResident(r.id)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-left"
                    >
                      <div className="text-sm text-white">{displayName(r)}</div>
                      <div className="mt-0.5 text-[11px] text-white/45">{presenceLabel(r)}</div>
                    </button>
                  ))}
                  {filteredResidents.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-white/50">No residents found.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-2">
            {loading ? <div className="px-3 py-3 text-xs text-white/50">Loading...</div> : null}
            {!loading && filteredThreads.length === 0 ? (
              <div className="px-3 py-3 text-xs text-white/50">No messages yet.</div>
            ) : null}

            <div className="space-y-1">
              {filteredThreads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveThread(t);
                    setView("chat");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 hover:bg-white/10 px-3 py-2.5 text-left transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/90 text-sm">
                      {initials(t.peer)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm text-white font-medium truncate">{displayName(t.peer)}</div>
                          <div className="text-[11px] text-white/40">{presenceLabel(t.peer)}</div>
                        </div>
                        <div className="text-[10px] text-white/45 shrink-0">{shortTime(t.last_message_at)}</div>
                      </div>
                      <div className="mt-0.5 text-xs text-white/55 truncate">
                        {t.last_message?.body || "Start conversation"}
                      </div>
                    </div>
                    {(t.unread_count || 0) > 0 ? (
                      <div className="min-w-5 rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-100 text-center">
                        {t.unread_count}
                      </div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-3xl border border-white/10 bg-white/5 p-3 min-h-[65vh] flex flex-col"
          style={{ paddingBottom: "calc(12px + var(--kb))" }}
        >
          <div className="border-b border-white/10 pb-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setView("list")}
              className="rounded-lg p-2 bg-white/10 border border-white/10 text-white/85"
              aria-label="Back"
            >
              <FiChevronLeft />
            </button>
            <div className="h-8 w-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/90 text-sm">
              {initials(activeThread?.peer)}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-white font-semibold truncate">{displayName(activeThread?.peer)}</div>
              <div className="text-[11px] text-white/45">{presenceLabel(activeThread?.peer)}</div>
            </div>
          </div>

          <div className="flex-1 overflow-auto py-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-xs text-white/50">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const mine = String(m.sender_id || "") === myId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                        mine ? "bg-cyan-500/20 text-cyan-100" : "bg-black/30 text-white border border-white/10"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                      <div className="mt-1 text-[10px] text-white/45">{shortTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="border-t border-white/10 pt-2 flex items-center gap-2 sticky bottom-0 bg-[rgba(15,23,42,0.88)] backdrop-blur-xl"
            style={{ paddingBottom: "calc(6px + var(--kb))" }}
          >
            <input
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message..."
              className="flex-1 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !compose.trim()}
              className="rounded-2xl px-3 py-2.5 bg-white text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
            >
              <FiSend className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
