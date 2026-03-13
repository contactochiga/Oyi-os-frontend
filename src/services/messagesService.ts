import API from "./api";

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export type ChatResident = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  home_id?: string | null;
};

export type InboxThread = {
  id: string;
  kind: "direct" | "group";
  peer?: ChatResident | null;
  last_message?: {
    id: string;
    body: string;
    sender_id?: string | null;
    created_at?: string | null;
  } | null;
  unread_count?: number;
  last_message_at?: string | null;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id?: string | null;
  body: string;
  created_at?: string | null;
  is_hidden?: boolean;
};

export const messagesService = {
  async listResidents(q = ""): Promise<ChatResident[]> {
    try {
      const res = await API.get("/messages/residents", { params: q ? { q } : undefined });
      return res.data?.residents ?? [];
    } catch (err) {
      console.warn("messagesService.listResidents error:", err);
      return [];
    }
  },

  async listInbox(): Promise<InboxThread[]> {
    try {
      const res = await API.get("/messages/inbox");
      return res.data?.threads ?? [];
    } catch (err) {
      console.warn("messagesService.listInbox error:", err);
      return [];
    }
  },

  async createOrGetDirectThread(peer_user_id: string) {
    try {
      const res = await API.post("/messages/thread/direct", { peer_user_id });
      return res.data as { ok?: boolean; thread?: any };
    } catch (err: any) {
      return { error: pickError(err, "Failed to open thread") } as any;
    }
  },

  async listMessages(threadId: string, before?: string, limit = 50): Promise<ChatMessage[]> {
    try {
      const res = await API.get(`/messages/thread/${encodeURIComponent(threadId)}/messages`, {
        params: {
          limit,
          ...(before ? { before } : {}),
        },
      });
      return res.data?.messages ?? [];
    } catch (err) {
      console.warn("messagesService.listMessages error:", err);
      return [];
    }
  },

  async sendMessage(threadId: string, body: string) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/messages`, { body });
      return res.data as { ok?: boolean; message?: ChatMessage };
    } catch (err: any) {
      return { error: pickError(err, "Failed to send message") } as any;
    }
  },

  async markRead(threadId: string) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/read`);
      return res.data as { ok?: boolean };
    } catch (err: any) {
      return { error: pickError(err, "Failed to mark read") } as any;
    }
  },

  async reportMessage(messageId: string, reason: string, details?: string) {
    try {
      const res = await API.post(`/messages/message/${encodeURIComponent(messageId)}/report`, {
        reason,
        details: details || null,
      });
      return res.data as { ok?: boolean };
    } catch (err: any) {
      return { error: pickError(err, "Failed to report message") } as any;
    }
  },
};

export default messagesService;

