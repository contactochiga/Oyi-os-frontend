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
export type ConsumerAutomation = { id: string; name: string; trigger: Record<string, any>; condition?: Record<string, any>; actions: SceneAction[]; enabled: boolean };
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
};

export const sceneService = {
  async listScenes(): Promise<ConsumerScene[]> {
    const res = await API.get("/scenes");
    return Array.isArray(res.data?.scenes) ? res.data.scenes : [];
  },
  async createScene(input: { name: string; description?: string; icon?: string; mood?: string; actions: SceneAction[] }) {
    const res = await API.post("/scenes", input);
    return res.data as ConsumerScene;
  },
  async updateScene(id: string, input: Partial<{ name: string; description?: string; icon?: string; mood?: string; actions: SceneAction[] }>) {
    const res = await API.patch(`/scenes/${encodeURIComponent(id)}`, input);
    return res.data as ConsumerScene;
  },
  async deleteScene(id: string) {
    const res = await API.delete(`/scenes/${encodeURIComponent(id)}`);
    return res.data;
  },
  async runScene(id: string, name?: string): Promise<SceneRunResult> {
    const res = await API.post(`/scenes/${encodeURIComponent(id)}/run`);
    if (typeof window !== "undefined") {
      const label = String(name || res.data?.scene?.name || res.data?.name || "").trim();
      if (label) {
        const detail = { id, name: label, at: new Date().toISOString() };
        window.localStorage.setItem("oyi:last-scene", JSON.stringify(detail));
        window.dispatchEvent(new CustomEvent("oyi:scene-activated", { detail }));
      }
    }
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
};
