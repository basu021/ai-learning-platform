"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Textarea } from "./textarea";

const LABELABLE = new Set<unknown>(["input", "select", "textarea", Input, Textarea]);

/**
 * Caption + control. Deliberately not a wrapping <label>: a label forwards
 * clicks to its first control, which breaks composite widgets (editor
 * toolbars, pickers). Simple controls are linked with htmlFor instead.
 */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const autoId = React.useId();
  let control = children;
  let htmlFor: string | undefined;
  if (React.isValidElement<{ id?: string }>(children) && (LABELABLE.has(children.type) || children.type === Select)) {
    htmlFor = children.props.id ?? autoId;
    control = React.cloneElement(children, { id: htmlFor });
  }
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </label>
      {control}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </div>
  );
}

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-gray-700 bg-gray-800/50 px-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-gray-800", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            value === t.value
              ? "border-indigo-500 text-indigo-300"
              : "border-transparent text-gray-400 hover:text-gray-200",
          )}
        >
          {t.label}
          {!!t.count && (
            <span className="rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-300">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-16", className)}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-12 text-center text-gray-500">
      <Icon className="mx-auto mb-3 h-10 w-10 text-gray-700" />
      <p className="font-medium text-gray-400">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
  className,
}: {
  tone?: "error" | "info" | "success" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: "border-red-500/20 bg-red-500/10 text-red-300",
    info: "border-indigo-500/20 bg-indigo-500/10 text-indigo-200",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  };
  return <div className={cn("rounded-lg border p-3 text-sm", tones[tone], className)}>{children}</div>;
}
