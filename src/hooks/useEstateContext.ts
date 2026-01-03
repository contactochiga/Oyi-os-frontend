import useAuth from "./useAuth";

export type EstateRole = "resident" | "admin" | "security";

export function useEstateContext() {
  const { user } = useAuth();

  return {
    ready: !!user,

    estateName: user?.estate_name ?? "My Estate",
    unitName: user?.unit_name ?? "My Unit",

    role: (user?.role as EstateRole) ?? "resident",

    estateId: user?.estate_id ?? null,
    unitId: user?.unit_id ?? null,
  };
}
