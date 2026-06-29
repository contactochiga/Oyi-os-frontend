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

export type OyiCoreExecutionHistoryParams = {
  limit?: number;
  deviceId?: string | null;
  provider?: string | null;
  origin?: string | null;
  action?: string | null;
  initiatorId?: string | null;
  status?: string | null;
};

export async function loadOyiCoreExecutionHistory(params: number | OyiCoreExecutionHistoryParams = 40) {
  const query = typeof params === "number" ? { limit: params } : params;
  const { data } = await API.get("/oyi/runtime/executions/history", { params: query });
  return Array.isArray(data?.executions) ? data.executions : [];
}

export async function loadOyiCoreExecutionStatistics(params: number | OyiCoreExecutionHistoryParams = 120) {
  const query = typeof params === "number" ? { limit: params } : params;
  const { data } = await API.get("/oyi/runtime/executions/stats/summary", { params: query });
  return {
    statistics: data?.statistics || null,
    operators: Array.isArray(data?.operators) ? data.operators : [],
    providers: Array.isArray(data?.providers) ? data.providers : [],
    estates: Array.isArray(data?.estates) ? data.estates : [],
    timeline: Array.isArray(data?.timeline) ? data.timeline : [],
  };
}
