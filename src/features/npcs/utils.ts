import type { NPC, NPCType } from "@/types/index";

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function npcTypeLabel(t: NPCType | undefined): string {
  if (t === "recurring") return "Recurring";
  if (t === "major") return "Major";
  return "Scene";
}

export function resolvedType(npc: NPC): NPCType {
  return npc.npcType ?? "scene";
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
