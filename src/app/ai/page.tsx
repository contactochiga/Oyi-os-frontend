import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Bot, Mic, Sparkles, Wand2 } from "lucide-react";

export default function AiAutomationModule() {
  return (
    <ConsumerModuleDashboard
      title="AI & Automation"
      subtitle="Oyi AI, voice commands, automations, smart scenes and resident-friendly home assistance."
      tabs={[
        { label: "Dashboard", href: "/ai" },
        { label: "Oyi AI", href: "/home?oyi=ai" },
        { label: "Voice", href: "/home?oyi=voice" },
        { label: "Automations", href: "/devices?tab=automations" },
        { label: "Scenes", href: "/devices?tab=scenes" },
      ]}
      metrics={[
        { label: "Oyi", value: "Ready", hint: "Resident context" },
        { label: "Voice", value: "Linked", hint: "AI console" },
        { label: "Scenes", value: "Smart", hint: "Device actions" },
        { label: "Automation", value: "Scoped", hint: "Home only" },
      ]}
      actions={[
        { label: "Open Oyi AI", href: "/home?oyi=ai", icon: Bot, body: "Launch the resident AI console from Home." },
        { label: "Voice Command", href: "/home?oyi=voice", icon: Mic, body: "Use voice actions when enabled." },
        { label: "Smart Scenes", href: "/devices?tab=scenes", icon: Sparkles, body: "Open device-based scenes." },
        { label: "Automations", href: "/devices?tab=automations", icon: Wand2, body: "Manage resident-safe automations." },
      ]}
      notes={["AI is now a first-class Consumer module instead of a hidden Home query only.", "Execution remains resident-scoped and permission-aware.", "Advanced planner work is still Tier 2 and intentionally not added here."]}
    />
  );
}
