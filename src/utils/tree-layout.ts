import type {
  HouseData,
  HouseMember,
  MemberType,
  ColValue,
} from "@/types/index";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LayoutConstants {
  ROW_H: number;
  NW: number;
  NH: number;
  COL_GAP: number;
  SPINE_X: number;
  COL0: number;
  PAD_TOP: number;
  PAD_SIDE: number;
  svgW: number;
  svgH: number;
  maxRow: number;
  spineColor: string;
}

export interface NodeStyle {
  fill: string;
  stroke: string;
  sw: number;
}

export type MemberPos = Record<string, { x: number; y: number }>;

// ─────────────────────────────────────────────────────────────────────────────
// Layout computation
// ─────────────────────────────────────────────────────────────────────────────

export function computeLayoutConstants(data: HouseData): LayoutConstants {
  const { spine, layout, members } = data;
  const ROW_H = layout?.row_height ?? 130;
  const NW = layout?.node_w ?? 148;
  const NH = layout?.node_h ?? 60;
  const COL_GAP = layout?.col_gap ?? 172;
  const SPINE_X = spine?.enabled ? (layout?.spine_x ?? 90) : 0;
  const COL0 = spine?.enabled
    ? (layout?.col_start ?? 290)
    : (layout?.col_start ?? 120);
  const PAD_TOP = 34;
  const PAD_SIDE = 20;
  const spineColor = spine?.color ?? "#3a8fc4";

  const maxRow = Math.max(...members.map((m) => m.row));
  const bioCols = members
    .filter((m) => m.col !== "spine")
    .map((m) => m.col as number);
  const maxCol = bioCols.length ? Math.max(...bioCols) : 1;
  const svgW = PAD_SIDE + COL0 + (maxCol - 1) * COL_GAP + NW + PAD_SIDE;
  const svgH = PAD_TOP + maxRow * ROW_H + 40;

  return {
    ROW_H,
    NW,
    NH,
    COL_GAP,
    SPINE_X,
    COL0,
    PAD_TOP,
    PAD_SIDE,
    svgW,
    svgH,
    maxRow,
    spineColor,
  };
}

export function rowY(row: number, c: LayoutConstants): number {
  return c.PAD_TOP + (row - 1) * c.ROW_H + c.ROW_H / 2;
}

export function colX(col: ColValue, c: LayoutConstants): number {
  if (col === "spine") return c.SPINE_X;
  return c.COL0 + (col - 1) * c.COL_GAP;
}

export function computePositions(
  members: HouseMember[],
  c: LayoutConstants,
): MemberPos {
  const pos: MemberPos = {};
  members.forEach((m) => {
    pos[m.id] = { x: colX(m.col, c), y: rowY(m.row, c) };
  });
  return pos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function toRoman(n: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ["X", "IX", "V", "IV", "I"];
  let out = "";
  for (let i = 0; i < vals.length; i++)
    while (n >= vals[i]) {
      out += syms[i];
      n -= vals[i];
    }
  return out;
}

export function nodeStyle(
  type: MemberType | string,
  c: LayoutConstants,
): NodeStyle {
  switch (type) {
    case "priestess":
      return { fill: "#0d2b43", stroke: c.spineColor, sw: 1.5 };
    case "current":
      return { fill: "#0d2b43", stroke: "#4caf50", sw: 2.5 };
    case "heir":
      return { fill: "#091e30", stroke: c.spineColor, sw: 1.5 };
    case "unknown":
      return { fill: "#111114", stroke: "#383530", sw: 1.5 };
    default:
      return { fill: "#14141a", stroke: "#35322c", sw: 1.5 };
  }
}
