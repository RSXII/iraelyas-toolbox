// ═══════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string): void {
  const t = document.getElementById("toast")!;
  t.textContent = msg;
  t.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}
