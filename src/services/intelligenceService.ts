import API from "./api";

export type IntelligenceMetricSummary = {
  events?: number;
  alerts?: number;
  visitors?: number;
  actions?: number;
  predictions?: number;
  critical_predictions?: number;
  workflows?: number;
  overdue_workflows?: number;
  escalated_workflows?: number;
  devices?: number;
  approvals?: number;
  attention?: number;
};

function numberFrom(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function compactSummary(data: any): IntelligenceMetricSummary {
  const summary = data?.summary || data || {};
  const nested = summary?.summary || summary;
  const predictions = nested?.predictions || nested;
  const workflows = nested?.workflows || nested?.workflow_status || nested;
  const events = nested?.events || nested;
  return {
    events: numberFrom(events?.total, events?.total_events, nested?.event_count),
    alerts: numberFrom(events?.attention, nested?.alerts, nested?.critical, nested?.attention),
    visitors: numberFrom(events?.by_category?.visitor, nested?.visitors),
    actions: numberFrom(nested?.actions),
    predictions: numberFrom(predictions?.prediction_count, nested?.prediction_count),
    critical_predictions: numberFrom(predictions?.critical_prediction_count, nested?.critical_prediction_count),
    workflows: numberFrom(workflows?.open_workflows, nested?.open_workflows),
    overdue_workflows: numberFrom(workflows?.overdue_workflows, nested?.overdue_workflows),
    escalated_workflows: numberFrom(workflows?.escalated_workflows, nested?.escalated_workflows),
    devices: numberFrom(events?.by_category?.operational, nested?.devices),
    approvals: numberFrom(nested?.approvals, nested?.pending_approvals),
    attention: numberFrom(events?.attention, nested?.attention, predictions?.critical_prediction_count, workflows?.critical_workflows),
  };
}

export const intelligenceService = {
  async summary(type: "consumer" | "facility" | "office" | "watch" | "camera" | "edge" = "consumer") {
    const res = await API.get("/intelligence/summary", { params: { type } });
    return { raw: res.data, metrics: compactSummary(res.data) };
  },

  async predictionsSummary() {
    const res = await API.get("/intelligence/predictions/summary");
    return { raw: res.data, metrics: compactSummary(res.data) };
  },

  async workflowsOpen() {
    const res = await API.get("/intelligence/workflows/open");
    return { raw: res.data, metrics: compactSummary(res.data) };
  },
};
