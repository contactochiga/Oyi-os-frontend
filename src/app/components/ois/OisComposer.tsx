"use client";

import type { FormEvent } from "react";

export type OisComposerVariant = "consumer" | "facility" | "office" | "command";

const variants: Record<OisComposerVariant, string> = {
  consumer: "border-[var(--ois-border-subtle)] bg-[var(--ois-canvas-overlay)] shadow-[var(--ois-elevation-oyi)]",
  facility: "border-[var(--ois-border-default)] bg-[var(--ois-canvas-overlay)] shadow-[var(--ois-elevation-overlay)]",
  office: "border-[var(--ois-border-default)] bg-[var(--ois-canvas-overlay)] shadow-[var(--ois-elevation-raised)]",
  command: "border-[var(--ois-border-strong)] bg-[var(--ois-canvas-raised)] shadow-[var(--ois-elevation-raised)]",
};

export default function OisComposer({ value, onChange, onSubmit, placeholder = "Message Oyi...", disabled = false, variant = "consumer" }: { value: string; onChange: (value: string) => void; onSubmit: (value: string) => void; placeholder?: string; disabled?: boolean; variant?: OisComposerVariant }) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (!disabled && value.trim()) onSubmit(value.trim()); };
  return <form onSubmit={submit} className="w-full pb-[calc(var(--ois-space-2)+var(--ois-safe-bottom))]"><div className={`flex items-end gap-[var(--ois-space-2)] rounded-[var(--ois-radius-nav)] border p-[var(--ois-space-2)] backdrop-blur ${variants[variant]}`}><textarea value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!disabled && value.trim()) onSubmit(value.trim()); } }} disabled={disabled} rows={1} placeholder={placeholder} className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-[var(--ois-space-2)] py-2 text-[var(--ois-type-body)] leading-[var(--ois-line-body)] text-[var(--ois-text-primary)] outline-none placeholder:text-[var(--ois-text-muted)]" /><button type="submit" disabled={disabled || !value.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ois-primary)] text-sm font-semibold text-slate-950 transition duration-[var(--ois-motion-fast)] disabled:opacity-40" aria-label="Send message">↑</button></div></form>;
}
