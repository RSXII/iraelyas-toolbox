import { store } from "@/state/store.svelte";
import { showToast } from "./ui/toast";
import { packRows } from "@/utils/chronicle-layout";
import type { TimelineData, TimelineItem, TintConfig } from "@/types/index";

// ── Year width (zoom) ──────────────────────────────────────────────────────

let YR_WIDTH = 68;

// ── Default tints (fallback when tint key not in data) ────────────────────

const DEFAULT_TINTS: Record<string, TintConfig> = {
  lore: { tint: "rgba(225,215,195,0.88)", accent: "#9a7848", text: "#3a2e1e" },
  war: { tint: "rgba(205,178,162,0.88)", accent: "#8a4830", text: "#3a1a0e" },
  intrigue: {
    tint: "rgba(136,150,207,0.88)",
    accent: "#7080bf",
    text: "#1e1630",
  },
  civic: { tint: "rgba(198,208,192,0.88)", accent: "#5a6848", text: "#202818" },
  political: {
    tint: "rgba(218,208,175,0.88)",
    accent: "#807040",
    text: "#302810",
  },
  noble: { tint: "rgba(205,192,222,0.88)", accent: "#68509a", text: "#2a1e48" },
  faculty: {
    tint: "rgba(215,208,188,0.88)",
    accent: "#7a6838",
    text: "#302a18",
  },
  student: {
    tint: "rgba(188,210,200,0.88)",
    accent: "#4a6858",
    text: "#182820",
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

export function initChronicle(): void {
  const slider = document.getElementById("yr-width-slider") as HTMLInputElement;
  slider.addEventListener("input", () => {
    YR_WIDTH = parseInt(slider.value);
    renderChronicle();
  });
}

export function importTimelineFile(): void {
  window.toolbox
    .importFile([
      { name: "JavaScript", extensions: ["js"] },
      { name: "JSON", extensions: ["json"] },
    ])
    .then((files) => {
      if (!files || !files.length) return;
      const cid = store.activeCampaignId;
      if (!cid) {
        showToast("Select a campaign first");
        return;
      }
      try {
        let raw = files[0].content;
        // Strip "const TIMELINE_DATA = " wrapper if present
        raw = raw
          .replace(/^\s*const\s+TIMELINE_DATA\s*=\s*/, "")
          .replace(/;\s*$/, "");
        const data: TimelineData = JSON.parse(raw);
        store.setTimeline(cid, data);
        renderChronicle();
        showToast("Timeline imported");
      } catch (err) {
        showToast(`Could not parse timeline — ${(err as Error).message}`);
      }
    });
}

export function exportTimelineFile(): void {
  const cid = store.activeCampaignId;
  const data = cid ? store.getTimeline(cid) : null;
  if (!data) {
    showToast("No timeline data to export");
    return;
  }
  const output = `const TIMELINE_DATA = ${JSON.stringify(data, null, 2)};\n`;
  window.toolbox.exportFile("timeline-data.js", output).then((result) => {
    if (result.ok) showToast("Timeline exported");
  });
}

export function scrollToNow(): void {
  const area = document.getElementById("tl-scroll-area") as HTMLElement | null;
  const cid = store.activeCampaignId;
  const data = cid ? store.getTimeline(cid) : null;
  if (!area || !data) return;
  const cfg = data.config;
  const nowPx = (cfg.currentYear - cfg.startYear) * YR_WIDTH;
  area.scrollLeft = nowPx - area.clientWidth / 2;
}

// ── Main renderer ──────────────────────────────────────────────────────────

export function renderChronicle(): void {
  const cid = store.activeCampaignId;
  const data = cid ? store.getTimeline(cid) : null;
  const root = document.getElementById("tl-root")!;

  if (!data) {
    root.innerHTML =
      '<div class="tl-empty">No timeline data — import a timeline-data.js file above.</div>';
    document.getElementById("tl-vault-title")!.textContent = "Chronicle";
    document.getElementById("chronicle-title")!.textContent = "Chronicle";
    return;
  }

  const cfg = data.config;
  const tints = { ...DEFAULT_TINTS, ...(data.tints ?? {}) };
  const vaultTitle = `${cfg.vault} — Chronicle`;

  document.getElementById("tl-vault-title")!.textContent = cfg.vault;
  document.getElementById("chronicle-title")!.textContent = vaultTitle;

  const totalYears = cfg.endYear - cfg.startYear;
  const packedSections = data.sections.map((s) => ({
    section: s,
    rows: packRows(s.items),
  }));

  root.innerHTML = "";

  // ── Label column (pinned) ──
  const labelCol = document.createElement("div");
  labelCol.className = "tl-label-col";

  packedSections.forEach(({ section }) => {
    const lbl = document.createElement("div");
    lbl.className = "tl-label-float";
    lbl.dataset.sectionId = section.id;
    lbl.innerHTML = `<span class="tl-section-label">${section.label}</span>`;
    labelCol.appendChild(lbl);
  });

  // ── Scroll area ──
  const scrollArea = document.createElement("div");
  scrollArea.className = "tl-scroll-area";
  scrollArea.id = "tl-scroll-area";

  const gridInner = document.createElement("div");
  gridInner.className = "tl-grid-inner";
  gridInner.style.width = `${totalYears * YR_WIDTH}px`;

  // Axis row
  const axisRow = document.createElement("div");
  axisRow.className = "tl-axis-row";
  const labelEvery = YR_WIDTH < 20 ? 10 : YR_WIDTH < 36 ? 5 : 1;
  for (let y = cfg.startYear; y < cfg.endYear; y++) {
    const c = document.createElement("div");
    c.className = "tl-year-cell";
    c.style.width = `${YR_WIDTH}px`;
    c.textContent = (y - cfg.startYear) % labelEvery === 0 ? `Yr ${y}` : "";
    axisRow.appendChild(c);
  }
  gridInner.appendChild(axisRow);

  // Sections
  packedSections.forEach(({ section, rows }, si) => {
    if (si > 0) {
      const div = document.createElement("div");
      div.className = "tl-section-divider";
      gridInner.appendChild(div);
    }

    const gEl = document.createElement("div");
    gEl.className = "tl-section-grid";
    gEl.dataset.sectionId = section.id;

    // Now line
    const nl = document.createElement("div");
    nl.className = "tl-now-line";
    nl.style.left = `${(cfg.currentYear - cfg.startYear) * YR_WIDTH}px`;
    gEl.appendChild(nl);

    rows.forEach((rowItems) => {
      const rEl = document.createElement("div");
      rEl.className = "tl-packed-row";
      rEl.style.width = `${totalYears * YR_WIDTH}px`;

      const ln = document.createElement("div");
      ln.className = "tl-col-lines";
      for (let y = 0; y < totalYears; y++) {
        const l = document.createElement("div");
        l.className = "tl-col-line";
        l.style.width = `${YR_WIDTH}px`;
        ln.appendChild(l);
      }
      rEl.appendChild(ln);

      rowItems.forEach((item) => {
        const tint = tints[item.tint] ?? DEFAULT_TINTS.lore;
        rEl.appendChild(makeItem(item, tint, cfg.startYear));
      });

      gEl.appendChild(rEl);
    });

    gridInner.appendChild(gEl);
  });

  scrollArea.appendChild(gridInner);

  const body = document.createElement("div");
  body.className = "tl-body";
  body.appendChild(labelCol);
  body.appendChild(scrollArea);
  root.appendChild(body);

  // Legend
  const legend = document.createElement("div");
  legend.className = "tl-legend";
  legend.innerHTML = `
    <div class="tl-leg-item"><div class="tl-leg-dot"></div>Point event</div>
    <div class="tl-leg-item">
      <div class="tl-leg-swatch" style="background:rgba(225,215,195,0.88);border-left-color:#9a7848;"></div>
      Duration span
    </div>
    <div style="flex:1"></div>
    <div class="tl-leg-item" id="tl-jump-now">▎ Current year (${cfg.currentYear})</div>`;
  root.appendChild(legend);

  requestAnimationFrame(() => {
    alignLabels(labelCol, gridInner);
    scrollToNow();
    document
      .getElementById("tl-jump-now")
      ?.addEventListener("click", scrollToNow);
  });
}

// ── Item factory ───────────────────────────────────────────────────────────

function makeItem(
  item: TimelineItem,
  tint: TintConfig,
  startYear: number,
): HTMLElement {
  if (item.type === "point") {
    const el = document.createElement("div");
    el.className = "tl-point";
    el.style.left = `${(item.year - startYear) * YR_WIDTH + 2}px`;
    el.innerHTML = `
      <div class="tl-point-dot" style="background:${tint.accent}"></div>
      <span class="tl-point-label" style="color:${tint.text}">${item.label}</span>`;
    return el;
  } else {
    const el = document.createElement("div");
    el.className = "tl-bar";
    el.style.left = `${(item.start - startYear) * YR_WIDTH + 1}px`;
    el.style.width = `${(item.end - item.start) * YR_WIDTH - 2}px`;
    el.style.background = tint.tint;
    el.style.borderLeftColor = tint.accent;
    el.style.color = tint.text;
    el.innerHTML = `<span>${item.label}</span>`;
    return el;
  }
}

// ── Label alignment ────────────────────────────────────────────────────────

function alignLabels(labelCol: HTMLElement, gridInner: HTMLElement): void {
  const axisEl = gridInner.querySelector(".tl-axis-row");
  const axisH = axisEl ? (axisEl as HTMLElement).offsetHeight : 0;

  gridInner
    .querySelectorAll<HTMLElement>(".tl-section-grid")
    .forEach((grid) => {
      const id = grid.dataset.sectionId!;
      const lbl = labelCol.querySelector<HTMLElement>(
        `[data-section-id="${id}"]`,
      );
      if (!lbl) return;
      lbl.style.top = `${axisH + grid.offsetTop}px`;
      lbl.style.height = `${grid.offsetHeight}px`;
    });
}
