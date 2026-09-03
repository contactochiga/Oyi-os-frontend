import { redirect } from "next/navigation";

/** Legacy Consumer bookmark. Resident services now have one canonical surface. */
export default function UtilitiesPage() {
  redirect("/services");
}
