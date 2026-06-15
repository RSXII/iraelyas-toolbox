type SceneFieldKey =
  | "npcFunction"
  | "distinctDetail"
  | "npcNeed"
  | "npcWound"
  | "npcGap"
  | "npcProtecting"
  | "npcBreak"
  | "npcBelief"
  | "npcContradiction";

export const scenePlaceholders: Record<SceneFieldKey, string> = {
  npcFunction:
    "What role do they serve in the world, not the plot. Defines what they do before the party ever shows up.",
  distinctDetail:
    "The one thing a player will remember them by. Not personality, something observable in the first thirty seconds.",
  npcNeed:
    "The tier their behavior is actually organized around. The engine underneath everything they do.",
  npcWound:
    "The specific historical event that made a lower tier feel permanently unstable. It doesn't have to be active, it just has to be present.",
  npcGap:
    "The distance between what they say they want and what they're actually operating from. The gap is where the drama lives.",
  npcProtecting:
    "The one concrete thing they would reorganize their life around keeping safe. Not abstract, specific.",
  npcBreak:
    'The specific condition under which the mask slips or the protected thing is threatened. Not "when pressured", the exact lever.',
  npcBelief:
    "A sincere belief, not a lie they're telling others. The place where their self perception and reality have quietly diverged.",
  npcContradiction:
    "Two people or loyalties they hold simultaneously whose needs are genuinely incompatible. The tension that generates scenes without you having to invent them.",
};
