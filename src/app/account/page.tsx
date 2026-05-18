import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Bell, Settings, ShieldCheck, UserRound } from "lucide-react";

export default function AccountModule() {
  return (
    <ConsumerModuleDashboard
      title="Account"
      subtitle="Profile, preferences, notifications, permissions and resident account controls."
      tabs={[
        { label: "Dashboard", href: "/account" },
        { label: "Profile", href: "/settings?tab=profile" },
        { label: "Preferences", href: "/settings?tab=settings" },
        { label: "Notifications", href: "/settings?tab=notifications" },
        { label: "Security", href: "/settings?tab=security" },
      ]}
      metrics={[
        { label: "Profile", value: "Ready", hint: "Resident identity" },
        { label: "Prefs", value: "Local", hint: "App settings" },
        { label: "Notify", value: "Linked", hint: "In-app alerts" },
        { label: "Access", value: "Scoped", hint: "Permissions" },
      ]}
      actions={[
        { label: "Edit Profile", href: "/settings?tab=profile", icon: UserRound, body: "Open your identity and profile details." },
        { label: "Preferences", href: "/settings?tab=settings", icon: Settings, body: "Manage app and home preferences." },
        { label: "Notifications", href: "/settings?tab=notifications", icon: Bell, body: "Control alert preferences." },
        { label: "Security", href: "/settings?tab=security", icon: ShieldCheck, body: "Review account and access settings." },
      ]}
      notes={["Account is now a module landing page instead of a direct redirect.", "The existing Settings page remains the live profile/settings editor.", "Resident permissions decide what account sections are visible in deeper flows."]}
    />
  );
}
