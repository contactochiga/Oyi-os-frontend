import ConsumerModuleDashboard from "@/app/components/modules/ConsumerModuleDashboard";
import { Droplets, Lightbulb, PlugZap, Thermometer } from "lucide-react";

export default function UtilitiesModule() {
  return (
    <ConsumerModuleDashboard
      title="Utilities"
      subtitle="Resident utility dashboard for power, water, lighting, climate and home utility services."
      tabs={[
        { label: "Dashboard", href: "/utilities" },
        { label: "Power", href: "/devices?category=power" },
        { label: "Water", href: "/devices?category=water" },
        { label: "Lighting", href: "/devices?category=lighting" },
        { label: "Climate", href: "/devices?category=climate" },
      ]}
      metrics={[
        { label: "Power", value: "Linked", hint: "Meters/devices" },
        { label: "Water", value: "Linked", hint: "Meter/service" },
        { label: "Lighting", value: "Smart", hint: "Room devices" },
        { label: "Climate", value: "Ready", hint: "AC/sensors" },
      ]}
      actions={[
        { label: "Power Devices", href: "/devices?category=power", icon: PlugZap, body: "Open power, sockets and metering devices." },
        { label: "Water Services", href: "/devices?category=water", icon: Droplets, body: "Open water-linked utility controls." },
        { label: "Lighting", href: "/devices?category=lighting", icon: Lightbulb, body: "Control room lights and smart scenes." },
        { label: "Climate", href: "/devices?category=climate", icon: Thermometer, body: "Open AC, HVAC and climate sensors." },
      ]}
      notes={["Utilities now has a real mobile-first module dashboard.", "Detailed utility controls remain inside Smart Devices until dedicated resident utility APIs expand.", "The page is compact for phone use and safe for tablet/iPad layouts."]}
    />
  );
}
