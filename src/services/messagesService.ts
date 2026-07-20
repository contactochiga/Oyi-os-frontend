import API from "./api";

function pickError(err: any, fallback: string) {
  const status = Number(err?.response?.status || 0);
  const message = String(err?.response?.data?.error || err?.response?.data?.message || err?.message || "").trim();
  if (status === 401) return "Please sign in again to load messages.";
  if (status === 403) return "This account does not have access to these messages.";
  if (status >= 500) return "Messages are temporarily unavailable. Try again.";
  return message && message.length < 180 ? message : fallback;
}

export type ChatResident = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  role?: string | null;
  home_id?: string | null;
  is_online?: boolean;
  last_seen_at?: string | null;
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
  message_type?: "text" | "image" | "video" | "file" | string;
  metadata?: Record<string, any> | null;
  created_at?: string | null;
  is_hidden?: boolean;
};

export type ThreadMessagesResponse = {
  messages: ChatMessage[];
  peer_last_read_at?: string | null;
};

export type UploadedMessageMedia = {
  ok?: boolean;
  url: string;
  mime?: string;
  mediaType?: "image" | "video";
  key?: string;
};

type ScopeParams = {
  estate_id?: string | null;
  home_id?: string | null;
};

function scopeParams(scope?: ScopeParams | null) {
  return {
    ...(scope?.estate_id ? { estate_id: scope.estate_id } : {}),
    ...(scope?.home_id ? { home_id: scope.home_id } : {}),
  };
}

export const messagesService = {
  async listResidents(q = "", scope?: ScopeParams | null): Promise<ChatResident[]> {
    try {
      const res = await API.get("/messages/residents", { params: { ...scopeParams(scope), ...(q ? { q } : {}) } });
      return res.data?.residents ?? [];
    } catch (err: any) {
      return { error: pickError(err, "Failed to load residents") } as any;
    }
  },

  async listInbox(scope?: ScopeParams | null): Promise<InboxThread[]> {
    try {
      const res = await API.get("/messages/inbox", { params: scopeParams(scope) });
      return res.data?.threads ?? [];
    } catch (err: any) {
      return { error: pickError(err, "Failed to load messages") } as any;
    }
  },

  async createOrGetDirectThread(peer_user_id: string, scope?: ScopeParams | null) {
    try {
      const res = await API.post("/messages/thread/direct", { peer_user_id, ...scopeParams(scope) });
      return res.data as { ok?: boolean; thread?: any };
    } catch (err: any) {
      return { error: pickError(err, "Failed to open thread") } as any;
    }
  },

  async listMessages(threadId: string, before?: string, limit = 50, scope?: ScopeParams | null): Promise<ThreadMessagesResponse> {
    try {
      const res = await API.get(`/messages/thread/${encodeURIComponent(threadId)}/messages`, {
        params: {
          limit,
          ...scopeParams(scope),
          ...(before ? { before } : {}),
        },
      });
      return {
        messages: res.data?.messages ?? [],
        peer_last_read_at: res.data?.peer_last_read_at ?? null,
      };
    } catch (err: any) {
      return { messages: [], peer_last_read_at: null, error: pickError(err, "Failed to load thread messages") } as any;
    }
  },

  async sendMessage(threadId: string, body: string, scope?: ScopeParams | null) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/messages`, { body, ...scopeParams(scope) });
      return res.data as { ok?: boolean; message?: ChatMessage };
    } catch (err: any) {
      return { error: pickError(err, "Failed to send message") } as any;
    }
  },

  async sendMediaMessage(
    threadId: string,
    payload: {
      body?: string;
      message_type: "image" | "video";
      metadata: Record<string, any>;
      estate_id?: string | null;
      home_id?: string | null;
    }
  ) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/messages`, payload);
      return res.data as { ok?: boolean; message?: ChatMessage };
    } catch (err: any) {
      return { error: pickError(err, "Failed to send media message") } as any;
    }
  },

  async uploadMedia(input: {
    base64: string;
    mime: string;
    filename?: string;
    mediaType?: "image" | "video";
  }): Promise<UploadedMessageMedia> {
    try {
      const res = await API.post("/messages/media/upload", input);
      return res.data as UploadedMessageMedia;
    } catch (err: any) {
      return { error: pickError(err, "Failed to upload media") } as any;
    }
  },

  async markRead(threadId: string, scope?: ScopeParams | null) {
    try {
      const res = await API.post(`/messages/thread/${encodeURIComponent(threadId)}/read`, scopeParams(scope));
      return res.data as { ok?: boolean };
    } catch (err: any) {
      return { error: pickError(err, "Failed to mark read") } as any;
    }
  },

  async reportMessage(messageId: string, reason: string, details?: string, scope?: ScopeParams | null) {
    try {
      const res = await API.post(`/messages/message/${encodeURIComponent(messageId)}/report`, {
        reason,
        details: details || null,
        ...scopeParams(scope),
      });
      return res.data as { ok?: boolean };
    } catch (err: any) {
      return { error: pickError(err, "Failed to report message") } as any;
    }
  },

  async pingPresence(scope?: ScopeParams | null) {
    try {
      const res = await API.post("/messages/presence/ping", scopeParams(scope));
      return res.data as { ok?: boolean; last_seen_at?: string };
    } catch (err: any) {
      return { error: pickError(err, "Failed to update presence") } as any;
    }
  },
};

export default messagesService;
