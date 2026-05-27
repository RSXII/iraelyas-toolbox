import type { ThemeSettings } from "@/types/index";

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

/** Matches the current :root values in app.css exactly */
export const DEFAULT_THEME: ThemeSettings = {
  uiScale: 1.0,
  bgColor: "#111115",
  textColor: "#e2d8c8",
  accentColor: "#c9a84c",
};

// ═══════════════════════════════════════════════════════════════
// COLOR MATH
// ═══════════════════════════════════════════════════════════════

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.substring(0, 2), 16),
    parseInt(clean.substring(2, 4), 16),
    parseInt(clean.substring(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = h / 360,
    sn = s / 100,
    ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [rr, gg, bb] = hslToRgb(h, s, Math.min(100, l + amount));
  return rgbToHex(rr, gg, bb);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [rr, gg, bb] = hslToRgb(h, s, Math.max(0, l - amount));
  return rgbToHex(rr, gg, bb);
}

// ═══════════════════════════════════════════════════════════════
// APPLY
// ═══════════════════════════════════════════════════════════════

/**
 * Applies the given ThemeSettings to the document root by setting
 * CSS custom properties and CSS zoom. All derived values (surface/card
 * stack, gold scale, border alphas) are computed here so the CSS files
 * need no changes.
 */
export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;

  // UI scale — CSS zoom scales layout + typography uniformly in Chromium/Electron
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (root.style as any).zoom = String(theme.uiScale);

  // Background stack — derive surface/card/card-hover from base bg.
  // Saturation is capped at 25% on derived layers so that vivid color picks
  // don't tint every surface intensely; the bg itself keeps its chosen color.
  const [bgR, bgG, bgB] = hexToRgb(theme.bgColor);
  const [bgH, bgS, bgL] = rgbToHsl(bgR, bgG, bgB);
  const cappedS = Math.min(bgS, 25);
  const mkLayer = (addL: number): string =>
    rgbToHex(...hslToRgb(bgH, cappedS, Math.min(100, bgL + addL)));
  root.style.setProperty("--bg", theme.bgColor);
  root.style.setProperty("--surface", mkLayer(3));
  root.style.setProperty("--card", mkLayer(7));
  root.style.setProperty("--card-hover", mkLayer(10));

  // Text — also derive dim/faint variants so they track the chosen text color
  // rather than staying at the hardcoded brownish CSS defaults.
  root.style.setProperty("--text", theme.textColor);
  root.style.setProperty("--text-dim", darken(theme.textColor, 32));
  root.style.setProperty("--text-faint", darken(theme.textColor, 64));

  // Accent (gold) scale — derive pale/dim/glow variants + border alphas from base accent
  const [r, g, b] = hexToRgb(theme.accentColor);
  root.style.setProperty("--gold", theme.accentColor);
  root.style.setProperty("--gold-pale", lighten(theme.accentColor, 20));
  root.style.setProperty("--gold-dim", darken(theme.accentColor, 18));
  root.style.setProperty("--gold-glow", `rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty("--border", `rgba(${r}, ${g}, ${b}, 0.13)`);
  root.style.setProperty("--border-h", `rgba(${r}, ${g}, ${b}, 0.32)`);
}
