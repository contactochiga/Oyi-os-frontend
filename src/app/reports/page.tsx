import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Activity, BarChart3, FileText, ShieldCheck } from "lucide-react";

export default function ReportsModule() {
  return (
    <ConsumerModuleDashboard
      title="Reports"
      subtitle="Resident reports for device health, visitor activity, wallet/service history and support status."
      tabs={[
        { label: "Overview", href: "/reports" },
        { label: "Device Health", href: "/devices?tab=reports" },
        { label: "Visitor Activity", href: "/visitors?tab=activity" },
        { label: "Wallet History", href: "/wallet" },
        { label: "Support", href: "/maintenance" },
      ]}
      metrics={[
        { label: "Device", value: "Health", hint: "Smart devices" },
        { label: "Visitors", value: "Activity", hint: "Access logs" },
        { label: "Wallet", value: "History", hint: "Services" },
        { label: "Support", value: "Tickets", hint: "Maintenance" },
      ]}
      actions={[
        { label: "Device Reports", href: "/devices?tab=reports", icon: BarChart3, body: "Open smart device health and state." },
        { label: "Visitor Logs", href: "/visitors?tab=activity", icon: ShieldCheck, body: "Review guest access activity." },
        { label: "Wallet History", href: "/wallet", icon: FileText, body: "Open payments and services history." },
        { label: "Support Status", href: "/maintenance", icon: Activity, body: "Track active requests and maintenance reports." },
      ]}
      notes={["Reports are resident-scoped and intentionally lighter than Office analytics.", "Each report action routes to an existing live module.", "No Office-level intelligence is exposed to consumer users."]}
    />
  );
}
