import API from "./api";

export type SceneAction = { device_id: string; command: Record<string, any> };
export type ConsumerScene = { id: string; name: string; description?: string | null; icon?: string; mood?: string; actions: SceneAction[]; enabled?: boolean };
export type ConsumerAutomation = { id: string; name: string; trigger: Record<string, any>; condition?: Record<string, any>; actions: SceneAction[]; enabled: boolean };

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
  async runScene(id: string, name?: string) {
    const res = await API.post(`/scenes/${encodeURIComponent(id)}/run`);
    if (typeof window !== "undefined") {
      const label = String(name || res.data?.scene?.name || res.data?.name || "").trim();
      if (label) {
        const detail = { id, name: label, at: new Date().toISOString() };
        window.localStorage.setItem("oyi:last-scene", JSON.stringify(detail));
        window.dispatchEvent(new CustomEvent("oyi:scene-activated", { detail }));
      }
    }
    return res.data;
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
