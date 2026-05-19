import { store } from "@/state/store";
import { showToast } from "./ui/toast";
import type { HouseData, HouseMember, SpineConfig } from "@/types/index";

// ── Pan / zoom state ───────────────────────────────────────────────────────

let scale = 1;
let tx = 0;
let ty = 0;
let dragging = false;
let startX = 0;
let startY = 0;
let startTx = 0;
let startTy = 0;

// ── Public API ─────────────────────────────────────────────────────────────

export function renderHouseSelect(): void {
  const cd = store.activeCampaignData;
  const houses = cd ? Object.keys(cd.houses) : [];
  const sel = document.getElementById("house-select") as HTMLSelectElement;

  sel.innerHTML = houses.length
    ? houses
        .map((h) => {
          const label = cd!.houses[h].house || h;
          return `<option value="${h}"${h === store.activeHouseId ? " selected" : ""}>${label}</option>`;
        })
        .join("")
    : '<option value="">No houses loaded</option>';

  if (houses.length && !store.activeHouseId) {
    store.setActiveHouse(houses[0]);
  }
}

export function switchHouse(id: string): void {
  store.setActiveHouse(id);
  initTree();
}

export function importHouseFile(): void {
  window.toolbox
    .importFile([{ name: "JSON", extensions: ["json"] }])
    .then((files) => {
      if (!files || !files.length) return;
      const file = files[0];
      try {
        const data: HouseData = JSON.parse(file.content);
        const cid = store.activeCampaignId;
        if (!cid) {
          showToast("Select a campaign first");
          return;
        }
        const key = (data.house || "house")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_");
        store.upsertHouse(cid, key, data);
        store.setActiveHouse(key);
        renderHouseSelect();
        initTree();
        showToast(`${data.house} imported`);
      } catch {
        showToast("Invalid house JSON");
      }
    });
}

export function resetTreeView(): void {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

export function initTree(): void {
  const cid = store.activeCampaignId;
  const houseId = store.activeHouseId;
  const container = document.getElementById("tree-svg-container")!;
  const legend = document.getElementById("tree-legend")!;

  container.innerHTML = "";
  legend.innerHTML = "";

  const titleEl = document.getElementById("tree-title")!;

  if (!cid || !houseId) {
    titleEl.textContent = "—";
    container.innerHTML =
      '<div class="empty-state" style="padding:3rem">Import a house JSON to view the family tree.</div>';
    return;
  }

  const data = store.getHouse(cid, houseId);
  if (!data) {
    titleEl.textContent = "—";
    return;
  }

  titleEl.textContent = data.house;
  buildSVG(data);
  buildLegend(data.spine);
  setupPan();
}

// ── SVG builder ────────────────────────────────────────────────────────────

function buildSVG(data: HouseData): void {
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

  const NS = "http://www.w3.org/2000/svg";

  function rowY(row: number) {
    return PAD_TOP + (row - 1) * ROW_H + ROW_H / 2;
  }
  function colX(col: number | "spine") {
    if (col === "spine") return SPINE_X;
    return COL0 + (col - 1) * COL_GAP;
  }

  const pos: Record<string, { x: number; y: number }> = {};
  members.forEach((m) => {
    pos[m.id] = { x: colX(m.col), y: rowY(m.row) };
  });

  function byId(id: string): HouseMember | undefined {
    return members.find((m) => m.id === id);
  }

  const maxRow = Math.max(...members.map((m) => m.row));
  const bioCols = members
    .filter((m) => m.col !== "spine")
    .map((m) => m.col as number);
  const maxCol = bioCols.length ? Math.max(...bioCols) : 1;
  const svgW = PAD_SIDE + COL0 + (maxCol - 1) * COL_GAP + NW + PAD_SIDE;
  const svgH = PAD_TOP + maxRow * ROW_H + 40;

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", String(svgW));
  svg.setAttribute("height", String(svgH));
  svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);

  function el(
    tag: string,
    attrs: Record<string, string | number> = {},
    text = "",
  ): SVGElement {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text) e.textContent = text;
    return e;
  }

  const defs = el("defs");
  function makeArrow(id: string, color: string): SVGElement {
    const m = el("marker", {
      id,
      markerWidth: 7,
      markerHeight: 7,
      refX: 6,
      refY: 3.5,
      orient: "auto",
    });
    m.appendChild(el("path", { d: "M0,0 L0,7 L7,3.5 z", fill: color }));
    return m;
  }
  defs.appendChild(makeArrow("arr-bio", "#4a4540"));
  defs.appendChild(makeArrow("arr-adoptive", spineColor));
  defs.appendChild(makeArrow("arr-origin", "#1a5a8a"));
  svg.appendChild(defs);

  const gBg = el("g");
  const gLines = el("g");
  const gNodes = el("g");
  svg.appendChild(gBg);
  svg.appendChild(gLines);
  svg.appendChild(gNodes);

  // Row bands + roman numerals
  function toRoman(n: number): string {
    const vals = [10, 9, 5, 4, 1],
      syms = ["X", "IX", "V", "IV", "I"];
    let out = "";
    for (let i = 0; i < vals.length; i++)
      while (n >= vals[i]) {
        out += syms[i];
        n -= vals[i];
      }
    return out;
  }
  for (let r = 1; r <= maxRow; r++) {
    const y = rowY(r);
    if (r % 2 === 0) {
      gBg.appendChild(
        el("rect", {
          x: 0,
          y: y - NH / 2 - 10,
          width: svgW,
          height: NH + 20,
          fill: "rgba(255,255,255,0.012)",
        }),
      );
    }
    gBg.appendChild(
      el(
        "text",
        {
          x: spine?.enabled ? 8 : 6,
          y: y + 4,
          fill: "#252528",
          "font-family": "Cinzel,serif",
          "font-size": 9,
          "letter-spacing": "0.06em",
        },
        toRoman(r),
      ),
    );
  }

  // Spine divider
  if (spine?.enabled) {
    gBg.appendChild(
      el("line", {
        x1: SPINE_X + NW / 2 + 18,
        y1: PAD_TOP - 14,
        x2: SPINE_X + NW / 2 + 18,
        y2: svgH - 20,
        stroke: "#1a2a3a",
        "stroke-width": 1,
        "stroke-dasharray": "3 7",
      }),
    );
    const sl = el("text", {
      x: SPINE_X,
      y: PAD_TOP - 14,
      "text-anchor": "middle",
      "font-family": "Cinzel,serif",
      "font-size": 8,
      "letter-spacing": "0.1em",
      fill: spineColor,
      opacity: 0.7,
    });
    sl.textContent = (spine.label ?? "Succession Line").toUpperCase();
    gBg.appendChild(sl);
  }

  // Node styles
  function nodeStyle(type: string) {
    switch (type) {
      case "priestess":
        return { fill: "#0d2b43", stroke: spineColor, sw: 1.5 };
      case "current":
        return { fill: "#0d2b43", stroke: "#4caf50", sw: 2.5 };
      case "heir":
        return { fill: "#091e30", stroke: spineColor, sw: 1.5 };
      case "unknown":
        return { fill: "#111114", stroke: "#383530", sw: 1.5 };
      default:
        return { fill: "#14141a", stroke: "#35322c", sw: 1.5 };
    }
  }

  // Marriage lines
  const drawnMarriages = new Set<string>();
  members.forEach((n) => {
    if (!n.spouse) return;
    const key = [n.id, n.spouse].sort().join("|");
    if (drawnMarriages.has(key)) return;
    drawnMarriages.add(key);
    const a = pos[n.id],
      b = pos[n.spouse];
    if (!a || !b) return;
    const left = a.x < b.x ? a : b;
    const right = a.x < b.x ? b : a;
    const x1 = left.x + NW / 2,
      x2 = right.x - NW / 2,
      y = a.y;
    gLines.appendChild(
      el("line", {
        x1,
        y1: y,
        x2,
        y2: y,
        stroke: "#6a5828",
        "stroke-width": 1.5,
      }),
    );
    gLines.appendChild(
      el("circle", { cx: (x1 + x2) / 2, cy: y, r: 3, fill: "#6a5828" }),
    );
  });

  // Bio descent lines
  const drawnDrops = new Set<string>();
  members.forEach((n) => {
    if (n.col === "spine") return;
    const parents = [n.mother, n.father].filter((p): p is string => Boolean(p));
    if (!parents.length) return;
    const child = pos[n.id];
    let px: number, py: number;
    if (parents.length === 2) {
      const pa = pos[parents[0]],
        pb = pos[parents[1]];
      if (!pa || !pb) return;
      px = (pa.x + pb.x) / 2;
      py = pa.y;
    } else {
      const pa = pos[parents[0]];
      if (!pa) return;
      px = pa.x;
      py = pa.y;
    }
    const dropKey = `${[...parents].sort().join("+")}=>${n.id}`;
    if (drawnDrops.has(dropKey)) return;
    drawnDrops.add(dropKey);
    const startY = py + NH / 2,
      endY = child.y - NH / 2,
      midY = startY + (endY - startY) * 0.45;
    gLines.appendChild(
      el("path", {
        d: `M${px},${startY} L${px},${midY} L${child.x},${midY} L${child.x},${endY}`,
        fill: "none",
        stroke: "#3a3530",
        "stroke-width": 1.5,
        "marker-end": "url(#arr-bio)",
      }),
    );
  });

  // Spine succession
  if (spine?.enabled) {
    const spineNodes = members
      .filter((m) => m.col === "spine")
      .sort((a, b) => a.row - b.row);
    for (let i = 0; i < spineNodes.length - 1; i++) {
      const a = spineNodes[i],
        b = spineNodes[i + 1];
      if (b.adoptive !== a.id) continue;
      const pa = pos[a.id],
        pb = pos[b.id];
      gLines.appendChild(
        el("line", {
          x1: SPINE_X,
          y1: pa.y + NH / 2,
          x2: SPINE_X,
          y2: pb.y - NH / 2,
          stroke: spineColor,
          "stroke-width": 1.5,
          "stroke-dasharray": "6 4",
          "marker-end": "url(#arr-adoptive)",
        }),
      );
    }
  }

  // Origin lines
  if (spine?.enabled) {
    members.forEach((n) => {
      if (n.col !== "spine") return;
      const parents = [n.mother, n.father].filter((p): p is string =>
        Boolean(p),
      );
      if (!parents.length) return;
      const spinePos = pos[n.id];
      const parentRow = byId(parents[0])?.row;
      if (!parentRow) return;
      let px: number;
      if (parents.length === 2) {
        const pa = pos[parents[0]],
          pb = pos[parents[1]];
        if (!pa || !pb) return;
        px = (pa.x + pb.x) / 2;
      } else {
        const pa = pos[parents[0]];
        if (!pa) return;
        px = pa.x;
      }
      const dropY = rowY(parentRow) + NH / 2 + 20;
      const ls: Record<string, string | number> = {
        stroke: "#1a5a8a",
        "stroke-width": 1.5,
        "stroke-dasharray": "5 4",
      };
      gLines.appendChild(
        el("line", {
          x1: px,
          y1: rowY(parentRow) + NH / 2,
          x2: px,
          y2: dropY,
          ...ls,
        }),
      );
      gLines.appendChild(
        el("line", { x1: px, y1: dropY, x2: SPINE_X, y2: dropY, ...ls }),
      );
      gLines.appendChild(
        el("line", {
          x1: SPINE_X,
          y1: dropY,
          x2: SPINE_X,
          y2: spinePos.y - NH / 2,
          ...ls,
          "marker-end": "url(#arr-origin)",
        }),
      );
    });
  }

  // Nodes
  const tip = document.getElementById("tree-tip")!;

  members.forEach((n) => {
    const p = pos[n.id];
    const st = nodeStyle(n.type);
    const nx = p.x - NW / 2,
      ny = p.y - NH / 2;
    const g = el("g") as SVGGElement;
    g.style.cursor = "default";

    g.appendChild(
      el("rect", {
        x: nx + 3,
        y: ny + 3,
        width: NW,
        height: NH,
        rx: 5,
        ry: 5,
        fill: "rgba(0,0,0,0.45)",
      }),
    );
    g.appendChild(
      el("rect", {
        x: nx,
        y: ny,
        width: NW,
        height: NH,
        rx: 5,
        ry: 5,
        fill: st.fill,
        stroke: st.stroke,
        "stroke-width": st.sw,
      }),
    );

    const PS = NH - 8,
      px2 = nx + 4,
      py2 = ny + 4;
    g.appendChild(
      el("rect", {
        x: px2,
        y: py2,
        width: PS,
        height: PS,
        rx: 3,
        ry: 3,
        fill: "#0a0a0c",
        stroke: st.stroke,
        "stroke-width": 0.75,
        opacity: 0.8,
      }),
    );

    if (n.img) {
      const clipId = `clip-${n.id}`;
      const clipPath = el("clipPath", { id: clipId });
      clipPath.appendChild(
        el("rect", { x: px2, y: py2, width: PS, height: PS, rx: 3, ry: 3 }),
      );
      defs.appendChild(clipPath);
      const imgEl = el("image", {
        href: n.img,
        x: px2,
        y: py2,
        width: PS,
        height: PS,
        preserveAspectRatio: "xMidYMid slice",
      });
      imgEl.setAttribute("clip-path", `url(#${clipId})`);
      g.appendChild(imgEl);
    } else {
      const scx = px2 + PS / 2;
      const sg = el("g", { opacity: 0.28 });
      sg.appendChild(
        el("circle", {
          cx: scx,
          cy: py2 + PS * 0.33,
          r: PS * 0.18,
          fill: st.stroke,
        }),
      );
      sg.appendChild(
        el("path", {
          d: `M${scx - PS * 0.2},${py2 + PS * 0.96} Q${scx - PS * 0.12},${py2 + PS * 0.58} ${scx},${py2 + PS * 0.56} Q${scx + PS * 0.12},${py2 + PS * 0.58} ${scx + PS * 0.2},${py2 + PS * 0.96}`,
          fill: st.stroke,
        }),
      );
      g.appendChild(sg);
    }

    // Name text
    const textCX = nx + PS + 10 + (NW - PS - 14) / 2;
    const words = n.label.split(" ");
    let lines: string[];
    if (words.length <= 2) lines = [n.label];
    else if (words.length === 3)
      lines = [words.slice(0, 2).join(" "), words[2]];
    else {
      const mid = Math.ceil(words.length / 2);
      lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    const lh = 13;
    const startY = lines.length === 1 ? p.y : p.y - lh / 2;
    lines.forEach((line, li) => {
      g.appendChild(
        el(
          "text",
          {
            x: textCX,
            y: startY + li * lh,
            "text-anchor": "middle",
            "dominant-baseline": "middle",
            "font-family": "Cinzel,serif",
            "font-size": lines[0].length > 10 ? 9 : 10,
            "font-weight": 600,
            fill: n.type === "unknown" ? "#555" : "#ddd3bc",
            "letter-spacing": "0.02em",
          },
          line,
        ),
      );
    });

    // Spine badge
    if (["priestess", "current", "heir"].includes(n.type) && spine?.enabled) {
      const badge =
        n.type === "current"
          ? (spine.badge_current ?? "CURRENT")
          : n.type === "heir"
            ? (spine.badge_heir ?? "HEIR")
            : (spine.badge_former ?? "FORMER");
      g.appendChild(
        el(
          "text",
          {
            x: textCX,
            y: ny + NH - 8,
            "text-anchor": "middle",
            "font-family": "Cinzel,serif",
            "font-size": 6.5,
            "letter-spacing": "0.08em",
            fill: n.type === "current" ? "#4caf50" : spineColor,
            opacity: 0.85,
          },
          badge,
        ),
      );
    }

    // Tooltip
    g.addEventListener("mouseenter", () => {
      const parentNames = [n.mother, n.father]
        .filter((p): p is string => Boolean(p))
        .map((id) => byId(id)?.label ?? id)
        .join(" & ");
      tip.innerHTML = `
        <span class="tip-name">${n.label}</span>
        ${n.note ? `<span class="tip-line">${n.note}</span>` : ""}
        ${parentNames ? `<span class="tip-line">Parents: ${parentNames}</span>` : ""}
        ${n.adoptive ? `<span class="tip-line">Preceded by: ${byId(n.adoptive)?.label ?? n.adoptive}</span>` : ""}
      `;
      tip.classList.add("show");
    });
    g.addEventListener("mousemove", (e: MouseEvent) => {
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY - 10}px`;
    });
    g.addEventListener("mouseleave", () => tip.classList.remove("show"));

    gNodes.appendChild(g);
  });

  document.getElementById("tree-svg-container")!.appendChild(svg);
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform();
}

// ── Legend ─────────────────────────────────────────────────────────────────

function buildLegend(spine?: SpineConfig): void {
  const legend = document.getElementById("tree-legend")!;
  const spineColor = spine?.color ?? "#3a8fc4";

  const items = [
    ...(spine?.enabled
      ? [
          {
            type: "swatch",
            fill: "#0f2d47",
            stroke: spineColor,
            label: spine.label ?? "Succession line",
          },
          {
            type: "swatch",
            fill: "#0f2d47",
            stroke: "#4caf50",
            label: "Current head",
          },
        ]
      : []),
    {
      type: "swatch",
      fill: "#14141a",
      stroke: "#35322c",
      label: "Biological family",
    },
    ...(spine?.enabled
      ? [
          {
            type: "line",
            style: `background:repeating-linear-gradient(90deg,${spineColor} 0,${spineColor} 5px,transparent 5px,transparent 9px)`,
            label: "Institutional succession",
          },
          {
            type: "line",
            style:
              "background:repeating-linear-gradient(90deg,#1a5a8a 0,#1a5a8a 8px,transparent 8px,transparent 12px)",
            label: "Chosen from",
          },
        ]
      : []),
    { type: "line", style: "background:#3a3530", label: "Biological descent" },
    { type: "line", style: "background:#6a5828", label: "Marriage" },
  ];

  legend.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "tree-leg-item";
    if (item.type === "swatch") {
      div.innerHTML = `<div class="tree-leg-swatch" style="background:${item.fill};border-color:${item.stroke}"></div>${item.label}`;
    } else {
      div.innerHTML = `<div class="tree-leg-line" style="${item.style}"></div>${item.label}`;
    }
    legend.appendChild(div);
  });
}

// ── Pan / zoom ─────────────────────────────────────────────────────────────

function applyTransform(): void {
  const c = document.getElementById("tree-svg-container")!;
  c.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
}

function setupPan(): void {
  const wrap = document.getElementById("tree-wrap")!;

  wrap.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const ns = Math.min(Math.max(scale * delta, 0.15), 4);
      tx = mx - (mx - tx) * (ns / scale);
      ty = my - (my - ty) * (ns / scale);
      scale = ns;
      applyTransform();
    },
    { passive: false },
  );

  wrap.addEventListener("mousedown", (e: MouseEvent) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    wrap.classList.add("dragging");
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!dragging) return;
    tx = startTx + (e.clientX - startX);
    ty = startTy + (e.clientY - startY);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    document.getElementById("tree-wrap")?.classList.remove("dragging");
  });
}
