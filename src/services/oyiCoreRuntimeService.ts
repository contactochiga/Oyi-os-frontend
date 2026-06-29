import API from "./api";

export type OyiCoreConversationResponse = {
  id: string;
  intent: string;
  confidence: number;
  summary: string;
  answer: string;
  approvalRequired: boolean;
  executionSummary?: string;
  executionHistory?: Array<{
    executionId: string;
    action: string;
    status: string;
    origin: string | null;
    initiatorType: string | null;
    approvedBy: string | null;
    completedAt: string | null;
    duration: number | null;
  }>;
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

export async function loadOyiCoreExecutionHistory(limit = 40) {
  const { data } = await API.get("/oyi/runtime/executions/history", { params: { limit } });
  return Array.isArray(data?.executions) ? data.executions : [];
}

export async function loadOyiCoreExecutionStatistics(limit = 120) {
  const { data } = await API.get("/oyi/runtime/executions/stats/summary", { params: { limit } });
  return {
    statistics: data?.statistics || null,
    operators: Array.isArray(data?.operators) ? data.operators : [],
    providers: Array.isArray(data?.providers) ? data.providers : [],
    estates: Array.isArray(data?.estates) ? data.estates : [],
    timeline: Array.isArray(data?.timeline) ? data.timeline : [],
  };
}
