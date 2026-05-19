import type { TimelineItem } from "@/types/index";

// ─────────────────────────────────────────────────────────────────────────────
// Row packing
// ─────────────────────────────────────────────────────────────────────────────

interface Interval {
  start: number;
  end: number;
}

/**
 * Greedily pack timeline items into the minimum number of non-overlapping rows.
 * Items (points and spans) are placed in the first row where they don't overlap.
 */
export function packRows(items: TimelineItem[]): TimelineItem[][] {
  const occ: Interval[][] = [];
  const rowIdx: number[] = [];

  items.forEach((item) => {
    const s = item.type === "point" ? item.year : item.start;
    const e = item.type === "point" ? item.year + 0.85 : item.end;
    let placed = false;
    for (let r = 0; r < occ.length; r++) {
      if (!occ[r].some((iv) => s < iv.end && e > iv.start)) {
        occ[r].push({ start: s, end: e });
        rowIdx.push(r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      occ.push([{ start: s, end: e }]);
      rowIdx.push(occ.length - 1);
    }
  });

  const rows: TimelineItem[][] = Array.from({ length: occ.length }, () => []);
  items.forEach((item, i) => rows[rowIdx[i]].push(item));
  return rows;
}
