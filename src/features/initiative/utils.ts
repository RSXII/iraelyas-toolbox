export function genId(): string {
  return `init_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function rollD20(mod: number | ""): number {
  return Math.floor(Math.random() * 20) + 1 + (Number(mod) || 0);
}
