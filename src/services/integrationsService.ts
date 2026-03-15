import API from "./api";

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

export type SmartIntegrationProvider = "tuya" | "alexa" | "google_assistant";
export type GenericIntegrationResponse = {
  provider: SmartIntegrationProvider;
  connected: boolean;
  external_user_id?: string | null;
  masked_external_user_id?: string | null;
};

export async function getTuyaIntegration() {
  try {
    const res = await API.get("/me/integrations/tuya");
    return res.data as { provider: "tuya"; connected: boolean; tuya_uid?: string | null; masked_uid?: string | null };
  } catch (err: any) {
    return { error: pickError(err, "Failed to load Tuya integration") } as any;
  }
}

export async function saveTuyaIntegration(tuya_uid: string) {
  try {
    const res = await API.patch("/me/integrations/tuya", { tuya_uid });
    return res.data as { ok: boolean; provider: "tuya"; connected: boolean; tuya_uid?: string | null };
  } catch (err: any) {
    return { error: pickError(err, "Failed to save Tuya integration") } as any;
  }
}

export async function getGenericIntegration(provider: Exclude<SmartIntegrationProvider, "tuya">) {
  try {
    const res = await API.get(`/me/integrations/${provider}`);
    return res.data as GenericIntegrationResponse;
  } catch (err: any) {
    return { error: pickError(err, `Failed to load ${provider} integration`) } as any;
  }
}

export async function saveGenericIntegration(
  provider: Exclude<SmartIntegrationProvider, "tuya">,
  external_user_id: string
) {
  try {
    const res = await API.patch(`/me/integrations/${provider}`, { external_user_id });
    return res.data as GenericIntegrationResponse & { ok: boolean };
  } catch (err: any) {
    return { error: pickError(err, `Failed to save ${provider} integration`) } as any;
  }
}
