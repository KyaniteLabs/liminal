/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 */

export interface ExtractionConfig {
  maxDepth: number;        // D: 1-5, default 3
  maxNodes: number;        // N: 5-50, default 15
  branchingFactor: number; // Auto: min(7, ceil(N^(1/D)))
}

/**
 * Compute branching factor respecting Miller's Law (7 +/- 2).
 * Branching factor = min(7, ceil(N^(1/D)))
 */
export function computeBranchingFactor(N: number, D: number): number {
  return Math.min(7, Math.ceil(Math.pow(N, 1 / D)));
}

/**
 * Allocate node budget across 3 extraction passes.
 * D=1: all in pass 1 (flat)
 * D=2: 35% scaffold, 65% fill
 * D>=3: 25% scaffold, 40% fill, 35% validate (balanced)
 */
export function allocateBudget(N: number, D: number): { pass1: number; pass2: number; pass3: number } {
  const branching = computeBranchingFactor(N, D);

  if (D === 1) return { pass1: N, pass2: 0, pass3: 0 };
  if (D === 2) {
    const p1 = Math.max(2, Math.min(branching + 1, Math.ceil(N * 0.35)));
    return { pass1: p1, pass2: N - p1, pass3: 0 };
  }
  // D >= 3: balanced — 25% themes, 40% concepts, 35% details
  const p1 = Math.max(2, Math.min(branching + 2, Math.ceil(N * 0.25)));
  const p2 = Math.ceil(N * 0.40);
  const p3 = Math.max(0, N - p1 - p2);
  return { pass1: p1, pass2: p2, pass3: p3 };
}

/**
 * Per-depth node budget allocation for 3-Phase scaffold.
 * Returns levels[d] = number of nodes at depth d.
 *
 * Cognitive science constraints:
 * - Depth 0 (L0): ~22% of N, capped by branching factor (Rosch superordinate)
 * - Deeper levels get more nodes (Rosch's basic-level gets the most)
 * - Each level descends in abstraction (Hayakawa's Ladder)
 */
export function allocateLevelBudget(N: number, D: number): number[] {
  if (D === 1) return [N];

  const branching = computeBranchingFactor(N, D);
  const L0 = Math.max(2, Math.min(branching + 1, Math.ceil(N * 0.22)));

  if (D === 2) return [L0, N - L0];

  // D >= 3: weighted — deeper levels get more
  const remaining = N - L0;
  const weights: number[] = [];
  for (let i = 1; i < D; i++) weights.push(Math.max(1, D - i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const levels: number[] = [L0];
  let allocated = L0;
  for (let i = 1; i < D; i++) {
    const share = Math.max(1, Math.round(remaining * weights[i - 1]! / totalWeight));
    levels.push(share);
    allocated += share;
  }

  // Trim or extend to exactly match N
  let diff = allocated - N;
  while (diff > 0) {
    for (let i = levels.length - 1; i >= 1 && diff > 0; i--) {
      if (levels[i]! > 1) { levels[i]!--; diff--; }
    }
  }
  while (diff < 0) { levels[1]!++; diff++; }

  return levels;
}
