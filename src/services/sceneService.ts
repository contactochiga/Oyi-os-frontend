import API from "./api";

export type SceneAction = {
  device_id: string;
  command: Record<string, any>;
  label?: string | null;
  action_label?: string | null;
  device_name?: string | null;
  command_code?: string | null;
};
export type ConsumerScene = { id: string; name: string; description?: string | null; icon?: string; mood?: string; actions: SceneAction[]; enabled?: boolean };
export type ConsumerAutomation = {
  id: string;
  name: string;
  trigger: Record<string, any>;
  condition?: Record<string, any>;
  actions: SceneAction[];
  enabled: boolean;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  timezone?: string | null;
};
export type SceneRunActionResult = {
  device_id: string | null;
  device_name: string;
  action_label: string;
  status: "completed" | "accepted" | "pending_confirmation" | "failed" | "denied" | "skipped" | "timed_out" | string;
  command_execution_id?: string | null;
};
export type SceneRunResult = {
  ok?: boolean;
  scene_run_id: string;
  scene_id: string;
  scene_name: string;
  status: "completed" | "partially_completed" | "failed" | string;
  requested_at: string;
  completed_at?: string | null;
  counts: { total: number; completed: number; failed: number };
  actions: SceneRunActionResult[];
};
export type SceneValidationIssue = {
  code?: string | null;
  message?: string | null;
  error?: string | null;
  action_index?: number | null;
  canonical_device_id?: string | null;
  command_key?: string | null;
  exposed_channel_keys?: string[] | null;
  runtime_freshness?: string | null;
};

function sanitizedScenePayload(input: { name?: string; actions?: SceneAction[] }) {
  return {
    has_name: Boolean(String(input?.name || "").trim()),
    action_count: Array.isArray(input?.actions) ? input.actions.length : 0,
    actions: (input?.actions || []).map((action, index) => {
      const entry = Object.entries(action.command || {}).find(([key]) => !["source", "metadata", "meta", "idempotency_key", "command_key"].includes(String(key).toLowerCase()));
      return {
        action_index: index,
        canonical_device_id: action.device_id,
        device_name: action.device_name || null,
        command_key: entry ? String(entry[0]) : null,
        value_type: entry ? typeof entry[1] : "undefined",
        value: entry && (typeof entry[1] === "boolean" || typeof entry[1] === "number" || typeof entry[1] === "string") ? entry[1] : null,
      };
    }),
  };
}

export const sceneService = {
  async listScenes(): Promise<ConsumerScene[]> {
    const res = await API.get("/scenes");
    return Array.isArray(res.data?.scenes) ? res.data.scenes : [];
  },
  async createScene(input: { name: string; description?: string; icon?: string; mood?: string; actions: SceneAction[] }) {
    try {
      console.info("scene_create_request_payload", sanitizedScenePayload(input));
      const res = await API.post("/scenes", input);
      return res.data as ConsumerScene;
    } catch (error: any) {
      console.warn("scene_create_rejected_response", {
        status: error?.response?.status || null,
        data: error?.response?.data || null,
      });
      throw error;
    }
  },
  async updateScene(id: string, input: Partial<{ name: string; description?: string; icon?: string; mood?: string; actions: SceneAction[] }>) {
    try {
      if (input.actions) console.info("scene_update_request_payload", sanitizedScenePayload({ name: input.name, actions: input.actions }));
      const res = await API.patch(`/scenes/${encodeURIComponent(id)}`, input);
      return res.data as ConsumerScene;
    } catch (error: any) {
      console.warn("scene_update_rejected_response", {
        status: error?.response?.status || null,
        data: error?.response?.data || null,
      });
      throw error;
    }
  },
  async deleteScene(id: string) {
    const res = await API.delete(`/scenes/${encodeURIComponent(id)}`);
    return res.data;
  },
  async runScene(id: string): Promise<SceneRunResult> {
    const res = await API.post(`/scenes/${encodeURIComponent(id)}/run`);
    return res.data as SceneRunResult;
  },
  async listSceneRuns(id: string): Promise<SceneRunResult[]> {
    const res = await API.get(`/scenes/${encodeURIComponent(id)}/runs`);
    return Array.isArray(res.data?.runs) ? res.data.runs : [];
  },
  async listAutomations(): Promise<ConsumerAutomation[]> {
    const res = await API.get("/scenes/automations");
    return Array.isArray(res.data?.automations) ? res.data.automations : [];
  },
  async createAutomation(input: { name: string; trigger: Record<string, any>; condition?: Record<string, any>; actions: SceneAction[]; enabled?: boolean }) {
    const res = await API.post("/scenes/automations", input);
    return res.data as ConsumerAutomation;
  },
  async updateAutomation(id: string, input: Partial<{ name: string; trigger: Record<string, any>; condition?: Record<string, any>; actions: SceneAction[]; enabled: boolean }>) {
    const res = await API.patch(`/scenes/automations/${encodeURIComponent(id)}`, input);
    return res.data as ConsumerAutomation;
  },
  async deleteAutomation(id: string) {
    const res = await API.delete(`/scenes/automations/${encodeURIComponent(id)}`);
    return res.data;
  },
  async testAutomation(id: string): Promise<SceneRunResult> {
    const res = await API.post(`/scenes/automations/${encodeURIComponent(id)}/test`);
    return res.data as SceneRunResult;
  },
  async listAutomationRuns(id: string): Promise<SceneRunResult[]> {
    const res = await API.get(`/scenes/automations/${encodeURIComponent(id)}/runs`);
    return Array.isArray(res.data?.runs) ? res.data.runs.map((run: any) => ({
      ok: ["succeeded", "partially_succeeded"].includes(String(run.status)),
      scene_run_id: run.id,
      scene_id: run.automation_id,
      scene_name: "Automation",
      status: run.status,
      requested_at: run.started_at || run.created_at,
      completed_at: run.completed_at,
      counts: run.counts || { total: 0, completed: 0, failed: 0 },
      actions: Array.isArray(run.actions) ? run.actions : [],
    })) : [];
  },
};
