// Dynamic revision selection for CodeTracker.
//
// No stored schedules — priorityScore is recomputed on every "Generate Revision".
// Weights are configurable via SR_WEIGHTS so behavior can be tuned without
// touching the algorithm itself.

export type ProblemStatus = "solved" | "need_revision" | "mastered" | "forgotten";

export type Difficulty = "easy" | "medium" | "hard";

export type RevisionOutcome = "solved_again" | "forgot" | "too_easy" | "need_more_practice";

/** Configurable weights — tweak these to fine-tune revision behaviour. */
export const SR_WEIGHTS = {
  // Status
  needRevision: 100,
  forgotten: 100,
  solved: 25,
  mastered: 2,

  // Review count buckets (fewer reviews → higher priority)
  review1: 60,
  review2: 40,
  review3to5: 20,
  reviewGt5: 5,

  // Difficulty (medium first, then hard, then easy)
  difficultyMedium: 25,
  difficultyHard: 18,
  difficultyEasy: 8,

  // Time since last revision — up to +30
  maxDaysSinceCap: 60,
  daysSinceMultiplier: 0.5, // 60 * 0.5 = 30

  // Never revised boost
  neverRevisedBoost: 20,

  // Random jitter used as tiebreaker (0..this)
  jitter: 8,
};

export interface SmartRevisionCandidate {
  id: string;
  times_solved: number;
  status: string;
  difficulty: string;
  last_revised_at: string | null;
  date_first_solved: string;
  topics: string[];
}

export function priorityScore(p: SmartRevisionCandidate, now = Date.now()): number {
  const W = SR_WEIGHTS;
  let score = 0;

  // 1. Status — Need Revision / Forgotten always float to the top.
  switch (p.status) {
    case "need_revision":
      score += W.needRevision;
      break;
    case "forgotten":
      score += W.forgotten;
      break;
    case "solved":
      score += W.solved;
      break;
    case "mastered":
      score += W.mastered;
      break;
  }

  // 2. Review count — fewer reviews → much higher priority.
  const rc = p.times_solved ?? 1;
  if (rc <= 1) score += W.review1;
  else if (rc === 2) score += W.review2;
  else if (rc <= 5) score += W.review3to5;
  else score += W.reviewGt5;

  // 3. Difficulty — medium highest, hard next, easy lowest.
  if (p.difficulty === "medium") score += W.difficultyMedium;
  else if (p.difficulty === "hard") score += W.difficultyHard;
  else if (p.difficulty === "easy") score += W.difficultyEasy;

  // 4. Time since last revision (or first solve if never revised).
  if (!p.last_revised_at) {
    score += W.neverRevisedBoost;
  }
  const lastMs = p.last_revised_at
    ? new Date(p.last_revised_at).getTime()
    : new Date(p.date_first_solved).getTime();
  const daysSince = Math.max(0, Math.floor((now - lastMs) / 86_400_000));
  score += Math.min(daysSince, W.maxDaysSinceCap) * W.daysSinceMultiplier;

  // 5. Controlled randomness — small jitter so the same set doesn't repeat.
  score += Math.random() * W.jitter;

  return score;
}

export interface SmartPickOptions {
  topics?: string[];
  includeMastered?: boolean;
}

/**
 * Dynamically select the top-N problems by priorityScore.
 * Randomness is baked into the score via SR_WEIGHTS.jitter.
 */
export function pickSmartRevisionsScored<T extends SmartRevisionCandidate>(
  problems: T[],
  count: number,
  optsOrTopics?: string[] | SmartPickOptions,
): { p: T; s: number }[] {
  const opts: SmartPickOptions = Array.isArray(optsOrTopics)
    ? { topics: optsOrTopics }
    : (optsOrTopics ?? {});

  let pool = problems.slice();
  if (opts.topics && opts.topics.length) {
    pool = pool.filter((p) => p.topics.some((t) => opts.topics!.includes(t)));
  }
  if (!opts.includeMastered) {
    const nonMastered = pool.filter((p) => p.status !== "mastered");
    if (nonMastered.length >= count) pool = nonMastered;
  }
  if (pool.length === 0) return [];

  const now = Date.now();
  const scored = pool.map((p) => ({ p, s: priorityScore(p, now) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, Math.min(count, scored.length));
}

/**
 * Apply a revision outcome — updates only status; times_solved and
 * last_revised_at are updated by the caller. Kept simple; no scheduling.
 */
export function statusAfterOutcome(prev: ProblemStatus, outcome: RevisionOutcome): ProblemStatus {
  switch (outcome) {
    case "solved_again":
      return "solved";
    case "too_easy":
      return "mastered";
    case "need_more_practice":
      return "need_revision";
    case "forgot":
      return "forgotten";
  }
}
