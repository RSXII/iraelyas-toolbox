import { store } from '@/state/store';

// ── Mood helpers ───────────────────────────────────────────────────────────

function convoMood(score: number): { word: string; color: string } {
  if (score <= 3)  return { word: 'Poor',     color: 'var(--poor)'     };
  if (score <= 6)  return { word: 'Neutral',  color: 'var(--neutral)'  };
  if (score <= 9)  return { word: 'Positive', color: 'var(--positive)' };
  return                  { word: 'Revered',  color: 'var(--revered)'  };
}

// ── PC count buttons ───────────────────────────────────────────────────────

export function initConvoPCButtons(): void {
  const container = document.getElementById('pc-count-btns')!;
  container.querySelectorAll<HTMLButtonElement>('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.count!);
      store.setConvoPCCount(n);
      container.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderConvoSliders();
    });
  });
}

// ── Sync PC count button highlight to stored state ─────────────────────────

export function syncPCCountButtons(): void {
  const n = store.convo.pcCount;
  document.getElementById('pc-count-btns')!
    .querySelectorAll<HTMLButtonElement>('.filter-chip')
    .forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.count!) === n);
    });
}

// ── Slider render ──────────────────────────────────────────────────────────

export function renderConvoSliders(): void {
  const { pcCount, pcs } = store.convo;
  const container = document.getElementById('convo-sliders')!;

  let html = '';
  for (let i = 0; i < pcCount; i++) {
    const pc    = pcs[i];
    const score = pc.score;
    const mood  = convoMood(score);

    html += `
      <div class="convo-slider-card" id="convo-card-${i}">
        <div class="convo-slider-header">
          <input type="text" class="convo-pc-name-input"
            value="${escHtml(pc.name)}"
            placeholder="PC ${i + 1}"
            data-pc-index="${i}">
          <div class="convo-mood-display">
            <span class="convo-mood-word" id="convo-mood-${i}"
              style="color:${mood.color}">${mood.word}</span>
            <span class="convo-score-num" id="convo-score-${i}"
              style="color:${mood.color}">${score}</span>
          </div>
        </div>
        <div class="convo-track-wrap">
          <div class="convo-track-bg"></div>
          <input type="range" class="convo-slider" min="1" max="10" step="1"
            value="${score}" data-pc-index="${i}">
        </div>
        <div class="convo-tick-row">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<span class="convo-tick${n === score ? ' active' : ''}">${n}</span>`
          ).join('')}
        </div>
      </div>`;
  }

  container.innerHTML = html;

  // Attach slider listeners
  container.querySelectorAll<HTMLInputElement>('input[type="range"].convo-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const idx   = parseInt(slider.dataset.pcIndex!);
      const score = parseInt(slider.value);
      store.setConvoPCScore(idx, score);
      updateSliderUI(idx, score);
      updateAggregate();
    });
  });

  // Attach name listeners
  container.querySelectorAll<HTMLInputElement>('.convo-pc-name-input').forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.pcIndex!);
      store.setConvoPCName(idx, input.value || `PC ${idx + 1}`);
    });
  });

  updateAggregate();
}

// ── Update a single slider's display without full re-render ────────────────

function updateSliderUI(i: number, score: number): void {
  const mood = convoMood(score);

  const moodEl  = document.getElementById(`convo-mood-${i}`);
  const scoreEl = document.getElementById(`convo-score-${i}`);
  if (moodEl)  { moodEl.textContent = mood.word; moodEl.style.color = mood.color; }
  if (scoreEl) { scoreEl.textContent = String(score); scoreEl.style.color = mood.color; }

  // Update ticks
  const card = document.getElementById(`convo-card-${i}`);
  card?.querySelectorAll('.convo-tick').forEach((t, idx) => {
    t.classList.toggle('active', idx + 1 === score);
  });
}

// ── Aggregate ──────────────────────────────────────────────────────────────

function updateAggregate(): void {
  const { pcCount, pcs } = store.convo;
  const scores = pcs.slice(0, pcCount).map(p => p.score);
  const avg    = scores.reduce((a, b) => a + b, 0) / scores.length;
  const mood   = convoMood(Math.round(avg));

  const scoreEl = document.getElementById('agg-score')!;
  const moodEl  = document.getElementById('agg-mood')!;
  const barEl   = document.getElementById('agg-bar')!;

  scoreEl.textContent = avg.toFixed(1);
  scoreEl.style.color = mood.color;
  moodEl.textContent  = mood.word;
  moodEl.style.color  = mood.color;

  const pct = ((avg - 1) / 9) * 100;
  barEl.style.width      = `${pct}%`;
  barEl.style.background = mood.color;
}

// ── Reset ──────────────────────────────────────────────────────────────────

export function resetConvo(): void {
  store.resetConvo();
  renderConvoSliders();
}

// ── Convo title ────────────────────────────────────────────────────────────

export function initConvoTitle(): void {
  const input = document.getElementById('convo-title') as HTMLInputElement;
  input.value = store.convo.title;
  input.addEventListener('change', () => {
    store.setConvoTitle(input.value || 'Generic Conversation');
  });
}

// ── Utils ──────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
