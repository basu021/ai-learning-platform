"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { tasksApi, type SpacingInput, type SpacingPattern, type SpacingPreview } from "@/lib/api";
import { cn, formatDay } from "@/lib/utils";

const PATTERNS: { value: SpacingPattern; label: string }[] = [
  { value: "EXPONENTIAL", label: "Exponential (gap × N)" },
  { value: "FIBONACCI", label: "Fibonacci (1, 1, 2, 3, 5…)" },
  { value: "LINEAR", label: "Linear (gap + N)" },
  { value: "FIXED", label: "Fixed gap" },
  { value: "CUSTOM", label: "Custom days" },
];

export const SPACING_PRESETS: { label: string; value: SpacingInput }[] = [
  { label: "Ladder 1·3·5·9·15·21·29", value: { pattern: "CUSTOM", days: [1, 3, 5, 9, 15, 21, 29] } },
  { label: "×2", value: { pattern: "EXPONENTIAL", growth: 2, firstGap: 1, repetitions: 7 } },
  { label: "Gentle ×1.5", value: { pattern: "EXPONENTIAL", growth: 1.5, firstGap: 1, repetitions: 10 } },
  { label: "Steep ×3", value: { pattern: "EXPONENTIAL", growth: 3, firstGap: 1, repetitions: 6 } },
  { label: "Fibonacci", value: { pattern: "FIBONACCI", firstGap: 1, repetitions: 10 } },
  { label: "+1 day", value: { pattern: "LINEAR", growth: 1, firstGap: 1, repetitions: 10 } },
  { label: "+2 days", value: { pattern: "LINEAR", growth: 2, firstGap: 2, repetitions: 8 } },
];

const REPEAT_CHIPS = [5, 7, 10, 15, 20, 30];

const numOrNull = (v: string) => (v === "" ? null : Number(v));
const parseDays = (text: string) =>
  text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

/** Only the settings that matter for the pattern, so the server gets a clean body. */
export function cleanSpacing(s: SpacingInput): SpacingInput {
  const limits = { maxDays: s.maxDays ?? null };
  if (s.pattern === "CUSTOM") return { pattern: "CUSTOM", days: s.days ?? [], ...limits };
  return {
    pattern: s.pattern,
    repetitions: s.repetitions ?? 7,
    firstGap: s.firstGap ?? (s.pattern === "FIXED" ? 2 : 1),
    ...(s.pattern === "EXPONENTIAL" || s.pattern === "LINEAR" ? { growth: s.growth ?? (s.pattern === "EXPONENTIAL" ? 2 : 1) } : {}),
    maxGap: s.maxGap ?? null,
    ...limits,
  };
}

const sameSpacing = (a: SpacingInput, b: SpacingInput) => JSON.stringify(cleanSpacing(a)) === JSON.stringify(cleanSpacing(b));

/**
 * Spaced repetition settings with a live preview of the generated plan.
 * The plan is computed by the API, the same code that saves it.
 */
export function SpacingFields({
  value,
  onChange,
  startDate,
  startNote,
}: {
  value: SpacingInput;
  onChange: (s: SpacingInput) => void;
  /** First practice date, for showing real dates. */
  startDate?: string;
  /** Shown above the dates, e.g. "if completed today". */
  startNote?: string;
}) {
  const set = (patch: Partial<SpacingInput>) => onChange({ ...value, ...patch });
  const [daysText, setDaysText] = useState((value.days ?? []).join(", "));
  const [preview, setPreview] = useState<SpacingPreview | null>(null);
  const [error, setError] = useState("");

  // Keep the text box in step when a preset replaces the days.
  useEffect(() => {
    if (parseDays(daysText).join(",") !== (value.days ?? []).join(",")) setDaysText((value.days ?? []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.days]);

  const body = JSON.stringify(cleanSpacing(value));
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      tasksApi
        .spacingPreview(JSON.parse(body), startDate || undefined)
        .then((p) => live && (setPreview(p), setError("")))
        .catch((e) => live && (setPreview(null), setError(e instanceof Error ? e.message : "Check the settings")));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [body, startDate]);

  const custom = value.pattern === "CUSTOM";
  const total = preview?.totalDays ?? 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {SPACING_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px]",
              sameSpacing(value, p.value)
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                : "border-gray-700 text-gray-400 hover:text-gray-200",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Field label="Gap pattern">
        <Select value={value.pattern} onChange={(e) => set({ pattern: e.target.value as SpacingPattern, days: e.target.value === "CUSTOM" ? value.days ?? preview?.spacing.days : value.days })}>
          {PATTERNS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </Field>

      {custom ? (
        <Field label="Practice on days" hint="Day 1 is the start date, e.g. 1, 3, 5, 9, 15, 21, 29">
          <Input
            value={daysText}
            onChange={(e) => {
              setDaysText(e.target.value);
              set({ days: parseDays(e.target.value) });
            }}
            placeholder="1, 3, 5, 9, 15, 21, 29"
          />
        </Field>
      ) : (
        <>
          <Field label="How many times">
            <div className="flex flex-wrap items-center gap-1">
              {REPEAT_CHIPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set({ repetitions: n })}
                  className={cn(
                    "h-7 min-w-9 rounded-md border px-2 text-xs",
                    value.repetitions === n ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-200" : "border-gray-700 text-gray-400",
                  )}
                >
                  {n}
                </button>
              ))}
              <Input type="number" min={2} max={100} value={value.repetitions ?? ""} onChange={(e) => set({ repetitions: Number(e.target.value) || undefined })} className="h-7 w-16 text-xs" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="First gap (days)">
              <Input type="number" min={1} max={365} value={value.firstGap ?? (value.pattern === "FIXED" ? 2 : 1)} onChange={(e) => set({ firstGap: Number(e.target.value) || 1 })} />
            </Field>
            {value.pattern === "EXPONENTIAL" && (
              <Field label="Multiply gap by">
                <Input type="number" min={1} max={10} step={0.1} value={value.growth ?? 2} onChange={(e) => set({ growth: Number(e.target.value) })} />
              </Field>
            )}
            {value.pattern === "LINEAR" && (
              <Field label="Add to gap (days)">
                <Input type="number" min={0} max={10} value={value.growth ?? 1} onChange={(e) => set({ growth: Number(e.target.value) })} />
              </Field>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {!custom && (
          <Field label="Longest gap" hint="Optional, days">
            <Input type="number" min={1} max={365} value={value.maxGap ?? ""} onChange={(e) => set({ maxGap: numOrNull(e.target.value) })} placeholder="no limit" />
          </Field>
        )}
        <Field label="Total length" hint="Optional, days">
          <Input type="number" min={1} max={3650} value={value.maxDays ?? ""} onChange={(e) => set({ maxDays: numOrNull(e.target.value) })} placeholder="no limit" />
        </Field>
      </div>

      {error ? (
        <p className="text-xs text-red-300">{error}</p>
      ) : (
        preview && (
          <div className="space-y-2 rounded-md border border-gray-800 bg-gray-900/60 p-2">
            <p className="text-xs font-medium text-gray-200">{preview.label}</p>
            {/* Timeline: one dot per session, placed by day. */}
            <div className="relative mx-1 h-3">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gray-700" />
              {preview.sessions.map((s) => (
                <span
                  key={s.n}
                  title={`Day ${s.day}`}
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400"
                  style={{ left: `${total > 1 ? ((s.day - 1) / (total - 1)) * 100 : 0}%` }}
                />
              ))}
            </div>
            {startNote && <p className="text-[11px] text-gray-500">Dates {startNote}</p>}
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-gray-900 text-gray-500">
                  <tr>
                    <th className="py-0.5 text-left font-normal">#</th>
                    <th className="text-left font-normal">Day</th>
                    <th className="text-left font-normal">Gap</th>
                    {startDate && <th className="text-left font-normal">Date</th>}
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {preview.sessions.map((s) => (
                    <tr key={s.n} className="border-t border-gray-800/60">
                      <td className="py-0.5 text-gray-500">{s.n}</td>
                      <td>{s.day}</td>
                      <td className="text-gray-400">{s.gap ? `+${s.gap}` : "start"}</td>
                      {startDate && <td>{s.date && formatDay(s.date)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
