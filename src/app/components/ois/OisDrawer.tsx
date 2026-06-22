"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

const widths = { sm: "32rem", md: "40rem", lg: "48rem" };

export default function OisDrawer({ open, onClose, title, subtitle, children, footer, width = "md" }: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode; footer?: ReactNode; width?: "sm" | "md" | "lg" | string }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  const drawerWidth = widths[width as keyof typeof widths] || width;
  return <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="ml-auto flex h-[100dvh] w-full flex-col border-l border-[var(--ois-border-default)] bg-[var(--ois-canvas-overlay)] shadow-[var(--ois-elevation-overlay)] md:w-[var(--ois-drawer-width)]" style={{ "--ois-drawer-width": drawerWidth } as CSSProperties}><header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--ois-border-subtle)] bg-[var(--ois-canvas-overlay)] p-[var(--ois-space-4)] backdrop-blur"><div className="min-w-0"><h2 className="truncate text-[var(--ois-type-section-title)] font-semibold leading-[var(--ois-line-section-title)] text-[var(--ois-text-primary)]">{title || "Details"}</h2>{subtitle ? <p className="mt-1 text-[var(--ois-type-meta)] leading-[var(--ois-line-meta)] text-[var(--ois-text-muted)]">{subtitle}</p> : null}</div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--ois-radius-control)] border border-[var(--ois-border-default)] text-[var(--ois-text-secondary)]" aria-label="Close drawer">×</button></header><div className="min-h-0 flex-1 overflow-y-auto p-[var(--ois-space-4)] pb-[calc(var(--ois-space-8)+var(--ois-safe-bottom))]">{children}</div>{footer ? <footer className="border-t border-[var(--ois-border-subtle)] bg-[var(--ois-canvas-overlay)] p-[var(--ois-space-4)] pb-[calc(var(--ois-space-4)+var(--ois-safe-bottom))] backdrop-blur">{footer}</footer> : null}</aside></div>;
}
