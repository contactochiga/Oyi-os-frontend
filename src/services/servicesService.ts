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
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
};


export type HomeServiceRegistry = {
  ok?: boolean;
  estate_id: string;
  home_id: string;
  using_fallback?: boolean;
  wallet?: { balance?: number; currency?: string };
  electricity: ServiceRegistryEntry & { kct?: string | null; kctn?: string | null; provider_integration_mode?: string | null };
  water: ServiceRegistryEntry;
  gas?: ServiceRegistryEntry;
  internet: ServiceRegistryEntry & { plan?: string | null; expires_at?: string | null };
  generator_recovery?: ServiceRegistryEntry;
  solar_battery?: ServiceRegistryEntry & { plan?: string | null };
  estate_fees: { enabled: boolean; outstanding?: number | null; status: string; due_date?: string | null; last_payment_at?: string | null };
  facility_services: { enabled: boolean; available_count?: number; status?: string; last_payment_at?: string | null };
};

export type ServiceRegistryEntry = {
  enabled: boolean;
  meter_id?: string | null;
  account_id?: string | null;
  provider?: string | null;
  linked: boolean;
  status: string;
  balance?: number | null;
  last_payment_at?: string | null;
  tariff_profile?: string | null;
  billing_profile?: string | null;
  vending_readiness?: string | null;
  provider_health?: string | null;
  provisioning_status?: "not_provisioned" | "provisioned" | string | null;
  provider_status?: "not_required" | "pending" | "available" | "degraded" | "unavailable" | string | null;
  transaction_availability?: "available" | "temporarily_unavailable" | "not_supported" | string | null;
};

export type ServiceAccount = {
  id: string;
  home_id: string;
  service_key: ServiceKey;
  service_title: string;
  service_group: string;
  provider?: string | null;
  identifier?: string | null;
  meter_number?: string | null;
  account_number?: string | null;
  tariff_profile?: string | null;
  billing_profile?: string | null;
  kct?: string | null;
  kctn?: string | null;
  status?: string | null;
  linked?: boolean;
  plan?: string | null;
  wallet_linked?: boolean;
  resident_name?: string | null;
  home_label?: string | null;
  vending_readiness?: string | null;
  provider_health?: string | null;
  last_activity_at?: string | null;
  last_transaction_status?: string | null;
  last_transaction_type?: string | null;
  latest_transaction?: Record<string, any> | null;
  metadata?: Record<string, any>;
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

export type ServiceTransaction = {
  id: string;
  service_key: ServiceKey;
  status: string;
  transaction_type: string;
  settlement_status?: string | null;
  amount?: number;
  currency?: string | null;
  provider_reference?: string | null;
  metadata?: Record<string, any>;
  created_at?: string | null;
};

export type ElectricityQuote = {
  quote_id: string;
  service_key: "utility_token";
  service_title: "Electricity";
  amount: number;
  fee: number;
  tax: number;
  total_deduction: number;
  net_service_amount: number;
  currency: string;
  units?: number | null;
  unit_name?: string | null;
  tariff?: { rate?: number | null; unit_name?: string | null; effective_from?: string | null; issuer_name?: string | null; support_contact?: string | null };
  meter: { meter_id?: string | null; account_ref?: string | null };
  wallet: { wallet_account_id?: string | null; balance_before?: number; balance_after?: number; sufficient?: boolean };
  fulfilment: { method?: string | null; mode?: string | null; test_mode?: boolean };
  purchase_available?: boolean;
  unavailable_reason?: string | null;
};

export type ElectricityPurchaseResult = {
  ok?: boolean;
  wallet_charged?: boolean;
  balance?: number;
  transaction?: ServiceTransaction;
  receipt?: ServicePayment & Record<string, any>;
  quote?: ElectricityQuote;
  message?: string;
};

export type ServiceApiFailure = {
  error: string;
  code?: string | null;
  status?: number | null;
  diagnostics?: Record<string, any> | null;
};

function pickError(err: any, fallback: string) {
  return (
    err?.userMessage ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

function failure(err: any, fallback: string): ServiceApiFailure {
  return {
    error: pickError(err, fallback),
    code: err?.response?.data?.code || err?.response?.data?.error_code || err?.code || null,
    status: Number(err?.response?.status || 0) || null,
    diagnostics: err?.diagnostics || null,
  };
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
      return failure(err, "Failed to load home service registry") as any;
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
      return failure(err, "Failed to process service payment") as any;
    }
  },

  async myAccounts(params?: { estate_id?: string | null; home_id?: string | null }) {
    try {
      const res = await API.get("/services/accounts/me", {
        params: {
          estate_id: params?.estate_id || undefined,
          home_id: params?.home_id || undefined,
        },
      });
      return res.data as { ok?: boolean; accounts: ServiceAccount[] };
    } catch (err: any) {
      return { accounts: [] as ServiceAccount[], ...failure(err, "Failed to load resident service accounts") } as any;
    }
  },

  async initiateTransaction(payload: {
    service_key: ServiceKey;
    amount?: number;
    account_ref?: string;
    transaction_type?: string;
    notes?: string;
	    home_id?: string;
	    estate_id?: string;
	    idempotency_key?: string;
	  }) {
    try {
      const res = await API.post("/services/transactions", payload);
      return res.data as { ok?: boolean; transaction?: ServiceTransaction; provider?: Record<string, any>; message?: string };
    } catch (err: any) {
      return failure(err, "Failed to record service transaction") as any;
    }
  },

  async quoteElectricityPurchase(payload: { amount: number; meter_id?: string | null; account_ref?: string | null; estate_id?: string | null; home_id?: string | null }) {
    try {
      const res = await API.post("/services/electricity/quote", payload);
      return res.data as { ok?: boolean; quote?: ElectricityQuote };
    } catch (err: any) {
      return failure(err, "Failed to prepare electricity purchase") as any;
    }
  },

  async confirmElectricityPurchase(payload: { amount: number; meter_id?: string | null; account_ref?: string | null; estate_id?: string | null; home_id?: string | null; idempotency_key: string }) {
    try {
      const res = await API.post("/services/electricity/purchase", payload);
      return res.data as ElectricityPurchaseResult;
    } catch (err: any) {
      return failure(err, "Electricity purchase is temporarily unavailable. Your wallet has not been charged.") as any;
    }
  },

  async history(params?: { service_key?: ServiceKey; estate_id?: string; home_id?: string; limit?: number }) {
    try {
      const res = await API.get("/services/payments", { params });
      return (res.data?.payments || []) as ServicePayment[];
    } catch (err: any) {
      return { payments: [] as ServicePayment[], ...failure(err, "Failed to load service activity") } as any;
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
      return { configs: [] as ServiceConfig[], using_fallback: false, ...failure(err, "Failed to load service configs") } as any;
    }
  },
};

export default servicesService;
