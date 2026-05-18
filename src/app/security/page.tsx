import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Camera, KeyRound, ShieldCheck, UserPlus } from "lucide-react";

export default function SecurityAccessModule() {
  return (
    <ConsumerModuleDashboard
      title="Security & Access"
      subtitle="Your home access, visitors, guest codes, camera access and door-control surface."
      tabs={[
        { label: "Dashboard", href: "/security" },
        { label: "Visitors", href: "/visitors" },
        { label: "Guest Access", href: "/visitors?action=guest" },
        { label: "Door Controls", href: "/devices?category=access" },
      ]}
      metrics={[
        { label: "Access", value: "Ready", hint: "Resident-scoped" },
        { label: "Visitors", value: "Live", hint: "QR + approvals" },
        { label: "Cameras", value: "Scoped", hint: "If permitted" },
        { label: "Doors", value: "Linked", hint: "Access devices" },
      ]}
      actions={[
        { label: "Open Visitors", href: "/visitors", icon: UserPlus, body: "Create and track visitor access." },
        { label: "Door / Access Devices", href: "/devices?category=access", icon: KeyRound, body: "Open linked smart locks, gates and access devices." },
        { label: "Security Devices", href: "/devices?category=security", icon: ShieldCheck, body: "Review resident-visible security hardware." },
        { label: "Camera Access", href: "/devices?category=cameras", icon: Camera, body: "View camera devices when your role permits it." },
      ]}
      notes={["This is the resident security module landing page, not a silent redirect.", "It keeps complex facility controls out of the consumer UI.", "Permissions decide whether cameras and controls appear in the deep device pages."]}
    />
  );
}
