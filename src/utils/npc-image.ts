// ═══════════════════════════════════════════════════════════════
// NPC PORTRAIT — IMAGE CONFIG
// ═══════════════════════════════════════════════════════════════
// These constants are the single source of truth for portrait
// dimensions and quality across the entire app.
//
// Option B upgrade path: when images are stored as separate files
// instead of inline base64, raise these values here — that is the
// only change needed to improve portrait quality app-wide.

export const NPC_PORTRAIT_MAX_W = 220;
export const NPC_PORTRAIT_MAX_H = 280;
export const NPC_PORTRAIT_QUALITY = 0.75; // JPEG quality 0–1

// ═══════════════════════════════════════════════════════════════
// NPC PORTRAIT — PICK AND COMPRESS
// ═══════════════════════════════════════════════════════════════

/**
 * Opens the native file picker, selects an image, and returns a
 * compressed JPEG data URL resized to fit within the configured
 * portrait dimensions. Returns null if the user cancels or an
 * error occurs.
 *
 * Images smaller than the max dimensions are never upscaled.
 *
 * Option B upgrade path: add a `savePortraitToFile()` export
 * alongside this function once the zip-based backup system is in
 * place. The constants above will be raised at that point since
 * images will no longer be stored inline in the JSON.
 */
export async function pickAndCompressPortrait(): Promise<string | null> {
  const raw = await window.toolbox.pickImage();
  if (!raw) return null;

  return new Promise<string | null>((resolve) => {
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(
        NPC_PORTRAIT_MAX_W / img.width,
        NPC_PORTRAIT_MAX_H / img.height,
        1, // never upscale — small images stay small
      );
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", NPC_PORTRAIT_QUALITY));
    };

    img.onerror = () => resolve(null);
    img.src = raw;
  });
}
