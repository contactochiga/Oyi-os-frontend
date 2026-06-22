import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type OisCardVariant = "default" | "raised" | "hero" | "evidence" | "attention" | "critical";

const variants: Record<OisCardVariant, string> = {
  default: "ois-surface rounded-[var(--ois-radius-card)]",
  raised: "ois-surface-raised rounded-[var(--ois-radius-card)]",
  hero: "ois-surface-raised rounded-[var(--ois-radius-hero)] shadow-[var(--ois-elevation-raised)]",
  evidence: "ois-evidence-surface rounded-[var(--ois-radius-row)]",
  attention: "rounded-[var(--ois-radius-card)] border border-[var(--ois-status-attention-border)] bg-[var(--ois-status-attention-surface)]",
  critical: "rounded-[var(--ois-radius-card)] border border-[var(--ois-status-critical-border)] bg-[var(--ois-status-critical-surface)]",
};

export type OisCardProps<T extends ElementType = "section"> = {
  as?: T;
  variant?: OisCardVariant;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

export default function OisCard<T extends ElementType = "section">({
  as,
  variant = "default",
  className = "",
  children,
  ...props
}: OisCardProps<T>) {
  const Component = as || "section";
  return <Component className={`${variants[variant]} ${className}`.trim()} {...props}>{children}</Component>;
}
