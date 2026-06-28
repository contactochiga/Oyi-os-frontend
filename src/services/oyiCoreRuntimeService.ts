import API from "./api";

export type OyiCoreConversationResponse = {
  id: string;
  intent: string;
  confidence: number;
  summary: string;
  answer: string;
  approvalRequired: boolean;
  availableActions?: Array<{ title: string; type: string; target?: string }>;
};

export async function runOyiCoreConversation(query: string, context?: Record<string, any>) {
  const { data } = await API.post("/oyi/runtime/conversation", {
    request: {
      id: `consumer:${Date.now()}`,
      query,
      requestedDomain: typeof context?.panel === "string" ? context.panel : null,
      context,
    },
    signals: Array.isArray(context?.signals) ? context.signals : [],
    context,
  });

  return (data?.response || null) as OyiCoreConversationResponse | null;
}
