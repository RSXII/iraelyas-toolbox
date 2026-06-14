import type { TrackerEntry, TrackerWarning } from "@/types/index";

export function genId(): string {
  return `tracker_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function barColor(pct: number, hasWarning: boolean): string {
  if (hasWarning) return "var(--hostile)";
  if (pct >= 0.75) return "var(--allied)";
  if (pct >= 0.4) return "var(--friendly)";
  return "var(--neutral)";
}

export function activeWarnings(entry: TrackerEntry): TrackerWarning[] {
  return entry.warnings
    .filter((w) => entry.current >= w.value)
    .sort((a, b) => a.value - b.value);
}
