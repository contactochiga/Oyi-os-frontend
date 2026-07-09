import API from "./api";

export type ServiceKey =
  | "utility_token"
  | "water_service"
  | "gas_service"
  | "internet_service"
  | "fiber_internet"
  | "generator_recovery"
  | "solar_battery_service"
  | "service_charge"
  | "other_facility_fees";

export type ServiceConfig = {
  estate_id: string;
  service_key: ServiceKey;
  title: string;
  description: string;
  suggested_amount: number;
  currency: string;
  active: boolean;
  account_label: string;
  account_hint: string;
  payment_mode: "wallet_only";
  unit_cost?: number | null;
  unit_name?: string | null;
  billing_mode?: "wallet_only" | "metered" | "fixed";
  created_at?: string;
  updated_at?: string;
};


export type HomeServiceRegistry = {
  ok?: boolean;
  estate_id: string;
  home_id: string;
  using_fallback?: boolean;
  wallet?: { balance?: number; currency?: string };
  electricity: { enabled: boolean; meter_id?: string | null; provider?: string | null; linked: boolean; status: string; balance?: number | null; last_payment_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null; kct?: string | null; kctn?: string | null; provider_integration_mode?: string | null };
  water: { enabled: boolean; meter_id?: string | null; provider?: string | null; linked: boolean; status: string; balance?: number | null; last_payment_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null };
  gas?: { enabled: boolean; meter_id?: string | null; account_id?: string | null; provider?: string | null; linked: boolean; status: string; balance?: number | null; last_payment_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null };
  internet: { enabled: boolean; provider?: string | null; plan?: string | null; account_id?: string | null; linked: boolean; status: string; expires_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null };
  generator_recovery?: { enabled: boolean; provider?: string | null; account_id?: string | null; linked: boolean; status: string; last_payment_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null };
  solar_battery?: { enabled: boolean; provider?: string | null; plan?: string | null; account_id?: string | null; linked: boolean; status: string; last_payment_at?: string | null; tariff_profile?: string | null; billing_profile?: string | null };
  estate_fees: { enabled: boolean; outstanding?: number | null; status: string; due_date?: string | null; last_payment_at?: string | null };
  facility_services: { enabled: boolean; available_count?: number; status?: string; last_payment_at?: string | null };
};

export type ServicePayment = {
  id: string;
  amount: number;
  reference: string;
  status: string;
  created_at: string | null;
  service_key: ServiceKey;
  service_title?: string;
  account_ref: string;
  home_id: string;
  unit_cost?: number | null;
  unit_name?: string | null;
  computed_units?: number | null;
  billing_mode?: string | null;
  bundle_name?: string | null;
  period_label?: string | null;
  token_code?: string | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

export const servicesService = {

  async homeRegistry(params?: { estate_id?: string | null; home_id?: string | null; debug?: boolean }) {
    try {
      const res = await API.get("/services/home-registry", {
        params: {
          estate_id: params?.estate_id || undefined,
          home_id: params?.home_id || undefined,
          debug: params?.debug ? "1" : undefined,
        },
      });
      return res.data as HomeServiceRegistry;
    } catch (err: any) {
      return { error: pickError(err, "Failed to load home service registry") } as any;
    }
  },
  async pay(payload: { service_key: ServiceKey; amount: number; account_ref: string; bundle_name?: string; period_label?: string }) {
    try {
      const res = await API.post("/services/pay", payload);
      return res.data as {
        ok?: boolean;
        balance?: number;
        receipt?: ServicePayment;
      };
    } catch (err: any) {
      return { error: pickError(err, "Failed to process service payment") } as any;
    }
  },

  async history(params?: { service_key?: ServiceKey; home_id?: string; limit?: number }) {
    try {
      const res = await API.get("/services/payments", { params });
      return (res.data?.payments || []) as ServicePayment[];
    } catch {
      return [];
    }
  },

  async configs(params?: { estate_id?: string }) {
    try {
      const res = await API.get("/services/config", { params });
      return {
        configs: (res.data?.configs || []) as ServiceConfig[],
        using_fallback: Boolean(res.data?.using_fallback),
      };
    } catch (err: any) {
      return { configs: [] as ServiceConfig[], using_fallback: false, error: pickError(err, "Failed to load service configs") } as any;
    }
  },
};

export default servicesService;
