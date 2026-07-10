import type { GameSystem } from "@/types/index";

export function setGameSystem(system: GameSystem): void {
  if (system === "cpr") {
    document.documentElement.dataset.system = "cpr";
  } else {
    delete document.documentElement.dataset.system;
  }
}
