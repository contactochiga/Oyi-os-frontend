import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Bell, MessageSquare, ShieldAlert, Wrench } from "lucide-react";

export default function NotificationsModule() {
  return (
    <ConsumerModuleDashboard
      title="Notifications"
      subtitle="Resident alerts, home updates, visitor notices, maintenance messages and estate announcements."
      tabs={[
        { label: "Dashboard", href: "/notifications" },
        { label: "Visitors", href: "/visitors" },
        { label: "Maintenance", href: "/maintenance" },
        { label: "Community", href: "/community" },
      ]}
      metrics={[
        { label: "Unread", value: "Live", hint: "Pulled from home dashboard" },
        { label: "Visitor Alerts", value: "Active", hint: "Gate and guest updates" },
        { label: "Support", value: "Open", hint: "Maintenance notices" },
        { label: "Estate Notices", value: "Synced", hint: "Community broadcast layer" },
      ]}
      actions={[
        { label: "Open Visitors", href: "/visitors", icon: ShieldAlert, body: "Review guest, QR and access-related notices." },
        { label: "Open Maintenance", href: "/maintenance", icon: Wrench, body: "Review ticket and service request updates." },
        { label: "Open Community", href: "/community", icon: MessageSquare, body: "View estate announcements and discussions." },
        { label: "Notification Settings", href: "/settings?tab=notifications", icon: Bell, body: "Manage resident notification preferences." },
      ]}
      notes={[
        "This route now lands on a real resident notification module instead of a dead destination.",
        "Notification records remain tied to existing visitor, maintenance, community and home modules.",
        "Realtime badge counts can be wired here once the backend notification stream is finalized.",
      ]}
    />
  );
}
