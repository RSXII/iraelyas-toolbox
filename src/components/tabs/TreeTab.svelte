<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '@/state/store.svelte';
  import { showToast } from '@/state/toast.svelte';
  import type { HouseData, HouseMember, SpineConfig } from '@/types/index';
  import {
    computeLayoutConstants,
    computePositions,
    rowY as rowYFn,
    toRoman,
    nodeStyle,
  } from '@/utils/tree-layout';

  let { active = false }: { active?: boolean } = $props();

  // ── Reactive store slices ───────────────────────────────────────
  let cid = $derived(store.activeCampaignId);
  let cd  = $derived(store.activeCampaignData);
  let houseId = $derived(store.activeHouseId);
  let houses = $derived(cd ? Object.keys(cd.houses) : []);
  let data: HouseData | null = $derived(
    cid && houseId ? store.getHouse(cid, houseId) : null
  );
  let houseTitle = $derived(data ? data.house : '—');

  // ── DOM refs ────────────────────────────────────────────────────
  let containerEl = $state<HTMLElement | null>(null);
  let wrapEl      = $state<HTMLElement | null>(null);
  let tipEl       = $state<HTMLElement | null>(null);
  let legendEl    = $state<HTMLElement | null>(null);

  // ── Pan/zoom — plain vars for perf (no reactive overhead) ──────
  let scale = 1;
  let tx = 0;
  let ty = 0;

  function applyTransform(): void {
    if (containerEl) {
      containerEl.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
    }
  }

  function resetView(): void {
    scale = 1; tx = 0; ty = 0;
    applyTransform();
  }

  // ── Auto-select house when campaign changes ─────────────────────
  $effect(() => {
    const hs = houses;
    const hid = houseId;
    if (!hs.length) return;
    if (!hid || !hs.includes(hid)) {
      store.setActiveHouse(hs[0]);
    }
  });

  // ── Rebuild SVG whenever data changes ───────────────────────────
  $effect(() => {
    const d = data;
    if (!containerEl || !legendEl) return;
    containerEl.innerHTML = '';
    legendEl.innerHTML = '';
    if (!d) return;
    buildSVG(d);
    buildLegend(d.spine);
    resetView();
  });

  // ── Actions ─────────────────────────────────────────────────────
  function switchHouse(id: string): void {
    store.setActiveHouse(id);
  }

  async function importHouseFile(): Promise<void> {
    const files = await window.toolbox.importFile([
      { name: 'JSON', extensions: ['json'] },
    ]);
    if (!files || !files.length) return;
    try {
      const parsed: HouseData = JSON.parse(files[0].content);
      if (!cid) { showToast('Select a campaign first'); return; }
      const key = (parsed.house || 'house').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      store.upsertHouse(cid, key, parsed);
      store.setActiveHouse(key);
      showToast(`${parsed.house} imported`);
    } catch {
      showToast('Invalid house JSON');
    }
  }

  // ── SVG builder ─────────────────────────────────────────────────
  function buildSVG(data: HouseData): void {
    const { spine, members } = data;
    const c = computeLayoutConstants(data);
    const { NW, NH, SPINE_X, PAD_TOP, svgW, svgH, maxRow, spineColor } = c;

    const NS = 'http://www.w3.org/2000/svg';

    function rowY(row: number) { return rowYFn(row, c); }
    const pos = computePositions(members, c);
    function byId(id: string): HouseMember | undefined {
      return members.find((m) => m.id === id);
    }

    function el(
      tag: string,
      attrs: Record<string, string | number> = {},
      text = '',
    ): SVGElement {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      if (text) e.textContent = text;
      return e;
    }

    const svg = el('svg', {
      width: svgW, height: svgH, viewBox: `0 0 ${svgW} ${svgH}`,
    }) as SVGSVGElement;

    const defs = el('defs');
    function makeArrow(id: string, color: string): SVGElement {
      const m = el('marker', { id, markerWidth: 7, markerHeight: 7, refX: 6, refY: 3.5, orient: 'auto' });
      m.appendChild(el('path', { d: 'M0,0 L0,7 L7,3.5 z', fill: color }));
      return m;
    }
    defs.appendChild(makeArrow('arr-bio', '#4a4540'));
    defs.appendChild(makeArrow('arr-adoptive', spineColor));
    defs.appendChild(makeArrow('arr-origin', '#1a5a8a'));
    svg.appendChild(defs);

    const gBg    = el('g');
    const gLines = el('g');
    const gNodes = el('g');
    svg.appendChild(gBg);
    svg.appendChild(gLines);
    svg.appendChild(gNodes);

    // Row bands + roman numerals
    for (let r = 1; r <= maxRow; r++) {
      const y = rowY(r);
      if (r % 2 === 0) {
        gBg.appendChild(el('rect', {
          x: 0, y: y - NH / 2 - 10, width: svgW, height: NH + 20,
          fill: 'rgba(255,255,255,0.012)',
        }));
      }
      gBg.appendChild(el('text', {
        x: spine?.enabled ? 8 : 6, y: y + 4,
        fill: '#252528',
        'font-family': 'Cinzel,serif', 'font-size': 9, 'letter-spacing': '0.06em',
      }, toRoman(r)));
    }

    // Spine divider
    if (spine?.enabled) {
      gBg.appendChild(el('line', {
        x1: SPINE_X + NW / 2 + 18, y1: PAD_TOP - 14,
        x2: SPINE_X + NW / 2 + 18, y2: svgH - 20,
        stroke: '#1a2a3a', 'stroke-width': 1, 'stroke-dasharray': '3 7',
      }));
      const sl = el('text', {
        x: SPINE_X, y: PAD_TOP - 14,
        'text-anchor': 'middle',
        'font-family': 'Cinzel,serif', 'font-size': 8, 'letter-spacing': '0.1em',
        fill: spineColor, opacity: 0.7,
      });
      sl.textContent = (spine.label ?? 'Succession Line').toUpperCase();
      gBg.appendChild(sl);
    }

    // Marriage lines
    const drawnMarriages = new Set<string>();
    members.forEach((n) => {
      if (!n.spouse) return;
      const key = [n.id, n.spouse].sort().join('|');
      if (drawnMarriages.has(key)) return;
      drawnMarriages.add(key);
      const a = pos[n.id], b = pos[n.spouse];
      if (!a || !b) return;
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      const x1 = left.x + NW / 2, x2 = right.x - NW / 2, y = a.y;
      gLines.appendChild(el('line', { x1, y1: y, x2, y2: y, stroke: '#6a5828', 'stroke-width': 1.5 }));
      gLines.appendChild(el('circle', { cx: (x1 + x2) / 2, cy: y, r: 3, fill: '#6a5828' }));
    });

    // Bio descent lines
    const drawnDrops = new Set<string>();
    members.forEach((n) => {
      if (n.col === 'spine') return;
      const parents = [n.mother, n.father].filter((p): p is string => Boolean(p));
      if (!parents.length) return;
      const child = pos[n.id];
      let px: number, py: number;
      if (parents.length === 2) {
        const pa = pos[parents[0]], pb = pos[parents[1]];
        if (!pa || !pb) return;
        px = (pa.x + pb.x) / 2; py = pa.y;
      } else {
        const pa = pos[parents[0]];
        if (!pa) return;
        px = pa.x; py = pa.y;
      }
      const dropKey = `${[...parents].sort().join('+')}=>${n.id}`;
      if (drawnDrops.has(dropKey)) return;
      drawnDrops.add(dropKey);
      const startY = py + NH / 2, endY = child.y - NH / 2, midY = startY + (endY - startY) * 0.45;
      gLines.appendChild(el('path', {
        d: `M${px},${startY} L${px},${midY} L${child.x},${midY} L${child.x},${endY}`,
        fill: 'none', stroke: '#3a3530', 'stroke-width': 1.5, 'marker-end': 'url(#arr-bio)',
      }));
    });

    // Spine succession
    if (spine?.enabled) {
      const spineNodes = members.filter((m) => m.col === 'spine').sort((a, b) => a.row - b.row);
      for (let i = 0; i < spineNodes.length - 1; i++) {
        const a = spineNodes[i], b = spineNodes[i + 1];
        if (b.adoptive !== a.id) continue;
        const pa = pos[a.id], pb = pos[b.id];
        gLines.appendChild(el('line', {
          x1: SPINE_X, y1: pa.y + NH / 2, x2: SPINE_X, y2: pb.y - NH / 2,
          stroke: spineColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 4',
          'marker-end': 'url(#arr-adoptive)',
        }));
      }
    }

    // Origin lines
    if (spine?.enabled) {
      members.forEach((n) => {
        if (n.col !== 'spine') return;
        const parents = [n.mother, n.father].filter((p): p is string => Boolean(p));
        if (!parents.length) return;
        const spinePos = pos[n.id];
        const parentRow = byId(parents[0])?.row;
        if (!parentRow) return;
        let px: number;
        if (parents.length === 2) {
          const pa = pos[parents[0]], pb = pos[parents[1]];
          if (!pa || !pb) return;
          px = (pa.x + pb.x) / 2;
        } else {
          const pa = pos[parents[0]];
          if (!pa) return;
          px = pa.x;
        }
        const dropY = rowY(parentRow) + NH / 2 + 20;
        const ls: Record<string, string | number> = {
          stroke: '#1a5a8a', 'stroke-width': 1.5, 'stroke-dasharray': '5 4',
        };
        gLines.appendChild(el('line', { x1: px, y1: rowY(parentRow) + NH / 2, x2: px, y2: dropY, ...ls }));
        gLines.appendChild(el('line', { x1: px, y1: dropY, x2: SPINE_X, y2: dropY, ...ls }));
        gLines.appendChild(el('line', {
          x1: SPINE_X, y1: dropY, x2: SPINE_X, y2: spinePos.y - NH / 2,
          ...ls, 'marker-end': 'url(#arr-origin)',
        }));
      });
    }

    // Nodes
    const tip = tipEl!;

    members.forEach((n) => {
      const p = pos[n.id];
      const st = nodeStyle(n.type, c);
      const nx = p.x - NW / 2, ny = p.y - NH / 2;
      const g = el('g') as SVGGElement;
      g.style.cursor = 'default';

      // Drop shadow
      g.appendChild(el('rect', { x: nx + 3, y: ny + 3, width: NW, height: NH, rx: 5, ry: 5, fill: 'rgba(0,0,0,0.45)' }));
      // Card body
      g.appendChild(el('rect', { x: nx, y: ny, width: NW, height: NH, rx: 5, ry: 5, fill: st.fill, stroke: st.stroke, 'stroke-width': st.sw }));

      // Portrait square
      const PS = NH - 8, px2 = nx + 4, py2 = ny + 4;
      g.appendChild(el('rect', { x: px2, y: py2, width: PS, height: PS, rx: 3, ry: 3, fill: '#0a0a0c', stroke: st.stroke, 'stroke-width': 0.75, opacity: 0.8 }));

      if (n.img) {
        const clipId = `clip-${n.id}`;
        const clipPath = el('clipPath', { id: clipId });
        clipPath.appendChild(el('rect', { x: px2, y: py2, width: PS, height: PS, rx: 3, ry: 3 }));
        defs.appendChild(clipPath);
        const imgEl = el('image', { href: n.img, x: px2, y: py2, width: PS, height: PS, preserveAspectRatio: 'xMidYMid slice' });
        imgEl.setAttribute('clip-path', `url(#${clipId})`);
        g.appendChild(imgEl);
      } else {
        const scx = px2 + PS / 2;
        const sg = el('g', { opacity: 0.28 });
        sg.appendChild(el('circle', { cx: scx, cy: py2 + PS * 0.33, r: PS * 0.18, fill: st.stroke }));
        sg.appendChild(el('path', {
          d: `M${scx - PS * 0.2},${py2 + PS * 0.96} Q${scx - PS * 0.12},${py2 + PS * 0.58} ${scx},${py2 + PS * 0.56} Q${scx + PS * 0.12},${py2 + PS * 0.58} ${scx + PS * 0.2},${py2 + PS * 0.96}`,
          fill: st.stroke,
        }));
        g.appendChild(sg);
      }

      // Name text
      const textCX = nx + PS + 10 + (NW - PS - 14) / 2;
      const words = n.label.split(' ');
      let lines: string[];
      if (words.length <= 2)       lines = [n.label];
      else if (words.length === 3) lines = [words.slice(0, 2).join(' '), words[2]];
      else { const mid = Math.ceil(words.length / 2); lines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]; }
      const lh = 13;
      const textStartY = lines.length === 1 ? p.y : p.y - lh / 2;
      lines.forEach((line, li) => {
        g.appendChild(el('text', {
          x: textCX, y: textStartY + li * lh,
          'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-family': 'Cinzel,serif',
          'font-size': lines[0].length > 10 ? 9 : 10,
          'font-weight': 600,
          fill: n.type === 'unknown' ? '#555' : '#ddd3bc',
          'letter-spacing': '0.02em',
        }, line));
      });

      // Spine badge
      if (['priestess', 'current', 'heir'].includes(n.type) && spine?.enabled) {
        const badge =
          n.type === 'current' ? (spine.badge_current ?? 'CURRENT') :
          n.type === 'heir'    ? (spine.badge_heir    ?? 'HEIR')    :
                                 (spine.badge_former  ?? 'FORMER');
        g.appendChild(el('text', {
          x: textCX, y: ny + NH - 8,
          'text-anchor': 'middle', 'font-family': 'Cinzel,serif',
          'font-size': 6.5, 'letter-spacing': '0.08em',
          fill: n.type === 'current' ? '#4caf50' : spineColor, opacity: 0.85,
        }, badge));
      }

      // Tooltip
      g.addEventListener('mouseenter', () => {
        const parentNames = [n.mother, n.father]
          .filter((p): p is string => Boolean(p))
          .map((id) => byId(id)?.label ?? id)
          .join(' & ');
        tip.innerHTML = `
          <span class="tip-name">${n.label}</span>
          ${n.note ? `<span class="tip-line">${n.note}</span>` : ''}
          ${parentNames ? `<span class="tip-line">Parents: ${parentNames}</span>` : ''}
          ${n.adoptive ? `<span class="tip-line">Preceded by: ${byId(n.adoptive)?.label ?? n.adoptive}</span>` : ''}
        `;
        tip.classList.add('show');
      });
      g.addEventListener('mousemove', (e: MouseEvent) => {
        tip.style.left = `${e.clientX + 14}px`;
        tip.style.top  = `${e.clientY - 10}px`;
      });
      g.addEventListener('mouseleave', () => tip.classList.remove('show'));

      gNodes.appendChild(g);
    });

    containerEl!.appendChild(svg as unknown as HTMLElement);
  }

  // ── Legend builder ──────────────────────────────────────────────
  function buildLegend(spine?: SpineConfig): void {
    if (!legendEl) return;
    const spineColor = spine?.color ?? '#3a8fc4';
    const items = [
      ...(spine?.enabled ? [
        { type: 'swatch', fill: '#0f2d47', stroke: spineColor,  label: spine.label ?? 'Succession line' },
        { type: 'swatch', fill: '#0f2d47', stroke: '#4caf50',   label: 'Current head' },
      ] : []),
      { type: 'swatch', fill: '#14141a', stroke: '#35322c', label: 'Biological family' },
      ...(spine?.enabled ? [
        { type: 'line', style: `background:repeating-linear-gradient(90deg,${spineColor} 0,${spineColor} 5px,transparent 5px,transparent 9px)`, label: 'Institutional succession' },
        { type: 'line', style: 'background:repeating-linear-gradient(90deg,#1a5a8a 0,#1a5a8a 8px,transparent 8px,transparent 12px)', label: 'Chosen from' },
      ] : []),
      { type: 'line', style: 'background:#3a3530', label: 'Biological descent' },
      { type: 'line', style: 'background:#6a5828', label: 'Marriage' },
    ];
    items.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'tree-leg-item';
      if (item.type === 'swatch') {
        div.innerHTML = `<div class="tree-leg-swatch" style="background:${item.fill};border-color:${item.stroke}"></div>${item.label}`;
      } else {
        div.innerHTML = `<div class="tree-leg-line" style="${item.style}"></div>${item.label}`;
      }
      legendEl!.appendChild(div);
    });
  }

  // ── Pan / zoom (set up once on mount, cleaned up on destroy) ────
  onMount(() => {
    if (!wrapEl) return;

    let dragging = false;
    let startX = 0, startY = 0, startTx = 0, startTy = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = wrapEl!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const ns = Math.min(Math.max(scale * delta, 0.15), 4);
      tx = mx - (mx - tx) * (ns / scale);
      ty = my - (my - ty) * (ns / scale);
      scale = ns;
      applyTransform();
    };

    const handleMouseDown = (e: MouseEvent) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      wrapEl!.classList.add('dragging');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
    };

    const handleMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      wrapEl?.classList.remove('dragging');
    };

    wrapEl.addEventListener('wheel', handleWheel, { passive: false });
    wrapEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      wrapEl?.removeEventListener('wheel', handleWheel);
      wrapEl?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

<div class="tab-panel" id="panel-tree" class:active>
  <!-- ── Toolbar ── -->
  <div class="tree-toolbar">
    <span class="tree-house-label">House</span>
    <span class="tree-title">{houseTitle}</span>
    <div class="tree-toolbar-right">
      <select
        class="topbar-select"
        style="min-width: 180px"
        onchange={(e) => switchHouse((e.target as HTMLSelectElement).value)}
      >
        {#if houses.length}
          {#each houses as h (h)}
            <option value={h} selected={houseId === h}>
              {cd?.houses[h]?.house ?? h}
            </option>
          {/each}
        {:else}
          <option value="">No houses loaded</option>
        {/if}
      </select>
      <button class="btn btn-sm" onclick={importHouseFile}>Import House JSON</button>
      <button class="btn btn-sm" onclick={resetView}>Reset View</button>
    </div>
  </div>

  <!-- ── Pan/zoom viewport ── -->
  <div class="tree-wrap" bind:this={wrapEl}>
    {#if !data}
      <div class="empty-state" style="padding:3rem">
        Import a house JSON to view the family tree.
      </div>
    {/if}
    <!-- SVG injected here by buildSVG -->
    <div bind:this={containerEl}></div>
  </div>

  <!-- Legend (populated by buildLegend) -->
  <div class="tree-legend" bind:this={legendEl}></div>

  <!-- Tooltip (driven by SVG node mouseenter/mousemove/mouseleave) -->
  <div class="tree-tip" bind:this={tipEl}></div>
</div>
