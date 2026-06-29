import { create } from "zustand";

type RuntimeIntelState = {
  latestSignal: Record<string, any> | null;
  latestAwareness: Record<string, any> | null;
  latestInsights: Array<Record<string, any>>;
  latestRecommendations: Array<Record<string, any>>;
  latestAutomationPlans: Array<Record<string, any>>;
  latestExecution: Record<string, any> | null;
  ingest: (payload: {
    signal?: Record<string, any> | null;
    awareness?: Record<string, any> | null;
    insights?: Array<Record<string, any>>;
    recommendations?: Array<Record<string, any>>;
    automationPlans?: Array<Record<string, any>>;
    execution?: Record<string, any> | null;
  }) => void;
  reset: () => void;
};

export const useRuntimeIntelligenceStore = create<RuntimeIntelState>((set) => ({
  latestSignal: null,
  latestAwareness: null,
  latestInsights: [],
  latestRecommendations: [],
  latestAutomationPlans: [],
  latestExecution: null,
  ingest: (payload) =>
    set({
      latestSignal: payload.signal || null,
      latestAwareness: payload.awareness || null,
      latestInsights: Array.isArray(payload.insights) ? payload.insights.slice(0, 8) : [],
      latestRecommendations: Array.isArray(payload.recommendations) ? payload.recommendations.slice(0, 8) : [],
      latestAutomationPlans: Array.isArray(payload.automationPlans) ? payload.automationPlans.slice(0, 8) : [],
      latestExecution: payload.execution || null,
    }),
  reset: () =>
    set({
      latestSignal: null,
      latestAwareness: null,
      latestInsights: [],
      latestRecommendations: [],
      latestAutomationPlans: [],
      latestExecution: null,
    }),
}));
