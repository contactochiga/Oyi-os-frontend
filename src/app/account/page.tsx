import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Bell, CreditCard, KeyRound, Settings, ShieldCheck, UserRound, UsersRound } from "lucide-react";

export default function AccountModule() {
  return (
    <ConsumerModuleDashboard
      title="Profile"
      subtitle="Wallet, services, access permissions, family members, account settings and resident preferences."
      tabs={[
        { label: "Overview", href: "/account" },
        { label: "Wallet", href: "/wallet" },
        { label: "Services", href: "/services" },
        { label: "Access", href: "/visitors" },
        { label: "Settings", href: "/settings" },
      ]}
      metrics={[
        { label: "Profile", value: "Ready", hint: "Resident identity" },
        { label: "Wallet", value: "Linked", hint: "Payments/services" },
        { label: "Access", value: "Scoped", hint: "Family + guests" },
        { label: "Prefs", value: "Local", hint: "App settings" },
      ]}
      actions={[
        { label: "Wallet", href: "/wallet", icon: CreditCard, body: "Open balance, funding and transaction history." },
        { label: "Services", href: "/services", icon: ShieldCheck, body: "Pay estate services, utilities and facility dues." },
        { label: "Family & Access", href: "/visitors", icon: UsersRound, body: "Manage guests and access-related resident flows." },
        { label: "Edit Profile", href: "/settings?tab=profile", icon: UserRound, body: "Open your identity and profile details." },
        { label: "Preferences", href: "/settings?tab=settings", icon: Settings, body: "Manage app and home preferences." },
        { label: "Notifications", href: "/settings?tab=notifications", icon: Bell, body: "Control alert preferences." },
        { label: "Security", href: "/settings?tab=security", icon: KeyRound, body: "Review account and access settings." },
      ]}
      notes={[
        "Profile now links to wallet, services, family/access, account settings and preferences.",
        "Resident permissions decide what account sections are visible in deeper flows.",
        "No Office or Facility administration controls are exposed from this consumer surface.",
      ]}
    />
  );
}
