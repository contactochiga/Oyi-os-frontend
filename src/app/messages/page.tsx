"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ConsumerShell from "@/app/components/ConsumerShell";
import useAuth from "@/hooks/useAuth";
import messagesService, {
  ChatMessage,
  ChatResident,
  InboxThread,
} from "@/services/messagesService";
import { getSocket } from "@/services/socket";
import { FiCheck, FiCheckCircle, FiChevronLeft, FiEdit2, FiPaperclip, FiRefreshCw, FiSearch, FiSend } from "react-icons/fi";

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

function pickMessageMedia(message: ChatMessage) {
  const meta = message?.metadata || {};
  const mediaUrl = typeof meta?.media_url === "string" ? meta.media_url : "";
  if (!mediaUrl) return null;
  return {
    url: mediaUrl,
    type: message?.message_type === "video" ? "video" : "image",
    caption: typeof meta?.caption === "string" ? meta.caption : "",
  };
}

function wasReadByPeer(message: ChatMessage, peerLastReadAt?: string | null) {
  if (!peerLastReadAt || !message?.created_at) return false;
  return new Date(peerLastReadAt).getTime() >= new Date(message.created_at).getTime();
}

export default function MessagesPage() {
  const { user } = useAuth();
  const myId = useMemo(() => String((user as any)?.id || ""), [user]);

  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [residents, setResidents] = useState<ChatResident[]>([]);
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);

  const [listQuery, setListQuery] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [compose, setCompose] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [view, setView] = useState<"list" | "chat">("list");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: "image" | "video"; name?: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
      setPeerLastReadAt(null);
      return;
    }
    const res = await messagesService.listMessages(thread.id, undefined, 80);
    setMessages(Array.isArray(res?.messages) ? res.messages : []);
    setPeerLastReadAt(res?.peer_last_read_at || null);
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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onDm = (message: ChatMessage) => {
      if (!message?.thread_id) return;
      const threadId = String(message.thread_id);
      if (threadId === String(activeThread?.id || "")) {
        setMessages((prev) => {
          if (prev.some((item) => String(item.id) === String(message.id))) return prev;
          return [...prev, message];
        });
        void messagesService.markRead(threadId);
      }
      void loadInbox();
    };

    socket.on("dm:new", onDm);
    if (activeThread?.id) socket.emit("subscribe:thread", activeThread.id);

    return () => {
      socket.off("dm:new", onDm);
    };
  }, [activeThread?.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, pendingAttachment]);

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
    if (!text && !pendingAttachment) return;
    setSending(true);
    setErr(null);
    const res: any = pendingAttachment
      ? await messagesService.sendMediaMessage(activeThread.id, {
          body: text,
          message_type: pendingAttachment.type,
          metadata: {
            media_url: pendingAttachment.url,
            filename: pendingAttachment.name || null,
            caption: text || null,
          },
        })
      : await messagesService.sendMessage(activeThread.id, text);
    setSending(false);
    if (res?.error) {
      setErr(String(res.error));
      return;
    }
    setCompose("");
    setPendingAttachment(null);
    if (res?.message) {
      setMessages((prev) => (prev.some((item) => item.id === res.message.id) ? prev : [...prev, res.message]));
    }
    await loadThreadMessages(activeThread);
  }

  async function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  async function onPickMedia(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    setErr(null);
    try {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      const uploaded: any = await messagesService.uploadMedia({
        base64: await toBase64(file),
        mime: file.type || (mediaType === "video" ? "video/mp4" : "image/jpeg"),
        filename: file.name,
        mediaType,
      });
      if (uploaded?.error || !uploaded?.url) {
        setErr(String(uploaded?.error || "Failed to upload media"));
        return;
      }
      setPendingAttachment({ url: uploaded.url, type: mediaType, name: file.name });
    } catch (e: any) {
      setErr(e?.message || "Failed to upload media");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          className="rounded-3xl border border-white/10 bg-white/5 p-3 min-h-[65vh] flex flex-col overflow-hidden"
          style={{ minHeight: "calc(65vh - var(--kb) * 0.15)" }}
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

          <div
            ref={scrollRef}
            className="flex-1 overflow-auto py-4 pr-1 space-y-3"
            style={{ paddingBottom: "calc(18px + var(--kb) * 0.4)" }}
          >
            {messages.length === 0 ? (
              <div className="text-xs text-white/50">No messages yet.</div>
            ) : (
              messages.map((m) => {
                const mine = String(m.sender_id || "") === myId;
                const media = pickMessageMedia(m);
                const readByPeer = wasReadByPeer(m, peerLastReadAt);
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine ? (
                      <div className="mb-1 h-8 w-8 shrink-0 rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold text-white/80 flex items-center justify-center">
                        {initials(activeThread?.peer)}
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[82%] rounded-[24px] px-3.5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.18)] ${
                        mine
                          ? "bg-emerald-500/20 text-emerald-50 border border-emerald-400/20 rounded-br-[8px]"
                          : "bg-black/30 text-white border border-white/10 rounded-bl-[8px]"
                      }`}
                    >
                      {media ? (
                        <div className="mb-2 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                          {media.type === "video" ? (
                            <video src={media.url} controls className="max-h-72 w-full bg-black object-cover" />
                          ) : (
                            <img src={media.url} alt={media.caption || "Shared image"} className="max-h-72 w-full object-cover" />
                          )}
                        </div>
                      ) : null}
                      {m.body ? <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div> : null}
                      <div className={`mt-1.5 flex items-center gap-1 text-[10px] ${mine ? "justify-end text-emerald-100/65" : "justify-end text-white/45"}`}>
                        <span>{shortTime(m.created_at)}</span>
                        {mine ? (
                          readByPeer ? (
                            <FiCheckCircle className="h-3.5 w-3.5 text-cyan-300" />
                          ) : (
                            <span className="inline-flex items-center">
                              <FiCheck className="h-3 w-3 translate-x-[2px]" />
                              <FiCheck className="h-3 w-3 -ml-1" />
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {pendingAttachment ? (
            <div className="mb-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs text-white/70">Attachment ready</div>
                <button type="button" onClick={() => setPendingAttachment(null)} className="text-xs text-white/45">
                  Remove
                </button>
              </div>
              {pendingAttachment.type === "video" ? (
                <video src={pendingAttachment.url} controls className="max-h-48 w-full rounded-2xl bg-black object-cover" />
              ) : (
                <img src={pendingAttachment.url} alt="Pending attachment" className="max-h-48 w-full rounded-2xl object-cover" />
              )}
            </div>
          ) : null}

          <div
            className="border-t border-white/10 pt-3 sticky bottom-0 bg-[rgba(8,12,20,0.96)] backdrop-blur-xl"
            style={{ paddingBottom: "calc(10px + var(--sab) + var(--kb))" }}
          >
            <div className="flex items-end gap-2 rounded-[26px] border border-white/10 bg-black/25 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => onPickMedia(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/8 px-3 py-3 text-white/85"
                title="Attach image or video"
              >
                {uploadingMedia ? <FiRefreshCw className="animate-spin" /> : <FiPaperclip />}
              </button>
              <input
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message"
                className="min-h-[48px] flex-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!compose.trim() && !pendingAttachment)}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black text-sm font-semibold disabled:opacity-50"
              >
                <FiSend className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </ConsumerShell>
  );
}
