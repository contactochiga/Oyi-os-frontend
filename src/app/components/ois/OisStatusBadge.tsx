export type OisStatus = "stable" | "attention" | "warning" | "critical" | "unavailable" | "pending" | "verified" | "failed" | "escalated" | "blocked" | "overdue" | "resolved" | "completed";

const labels: Record<OisStatus, string> = {
  stable: "Stable", attention: "Attention", warning: "Warning", critical: "Critical", unavailable: "Unavailable", pending: "Pending", verified: "Verified", failed: "Failed", escalated: "Escalated", blocked: "Blocked", overdue: "Overdue", resolved: "Resolved", completed: "Completed",
};
const tokenStatus: Record<OisStatus, string> = {
  stable: "stable", attention: "attention", warning: "warning", critical: "critical", unavailable: "unavailable", pending: "attention", verified: "verified", failed: "failed", escalated: "escalated", blocked: "blocked", overdue: "overdue", resolved: "completed", completed: "completed",
};

function normalize(status: string): OisStatus {
  const value = status.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (Object.keys(labels) as OisStatus[]).includes(value as OisStatus) ? value as OisStatus : "unavailable";
}

export default function OisStatusBadge({ status, label, size = "sm", className = "" }: { status: OisStatus | string; label?: string; size?: "sm" | "md"; className?: string }) {
  const normalized = normalize(status);
  const token = tokenStatus[normalized];
  return <span className={`inline-flex items-center rounded-[var(--ois-radius-pill)] border font-medium ${size === "md" ? "px-2.5 py-1 text-[var(--ois-type-label)]" : "px-2 py-0.5 text-[var(--ois-type-eyebrow)]"} ${className}`} style={{ color: `var(--ois-status-${token})`, backgroundColor: `var(--ois-status-${token}-surface)`, borderColor: `var(--ois-status-${token}-border)` }}>{label || labels[normalized]}</span>;
}
