import API from "./api";

function pickError(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
}

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

