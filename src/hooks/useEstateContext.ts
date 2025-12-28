import useAuth from "./useAuth";

export function useEstateContext() {
  const { user } = useAuth();

  return {
    estateName: user?.estate_name || "My Estate",
    unitName: user?.unit_name || "My Unit",
    role: user?.role || "resident",
  };
}
