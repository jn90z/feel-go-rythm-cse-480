import type { SortAlgorithm, SortComparisonEntry } from "./sortingModel";

export interface SortLearningProfile {
  algorithm: SortAlgorithm;
  bestTime: string;
  averageTime: string;
  worstTime: string;
  space: string;
  stable: boolean;
  inPlace: boolean;
  strengths: string;
  caution: string;
}

export interface SortWorkRanking {
  entry: SortComparisonEntry;
  workScore: number;
  rank: number;
  winner: boolean;
}

const PROFILES: Record<SortAlgorithm, SortLearningProfile> = {
  bubble: {
    algorithm: "bubble",
    bestTime: "O(n²)",
    averageTime: "O(n²)",
    worstTime: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    strengths: "Very easy to visualize and teaches adjacent swaps clearly.",
    caution: "This lab intentionally runs every pass, so even an already sorted array is O(n²). An early-exit Bubble Sort variant can reach O(n) best case."
  },
  selection: {
    algorithm: "selection",
    bestTime: "O(n²)",
    averageTime: "O(n²)",
    worstTime: "O(n²)",
    space: "O(1)",
    stable: false,
    inPlace: true,
    strengths: "Uses relatively few writes because each pass places one selected minimum.",
    caution: "It still scans the remaining array every pass, so comparisons stay quadratic."
  },
  insertion: {
    algorithm: "insertion",
    bestTime: "O(n)",
    averageTime: "O(n²)",
    worstTime: "O(n²)",
    space: "O(1)",
    stable: true,
    inPlace: true,
    strengths: "Excellent for small or nearly sorted data and has low overhead.",
    caution: "Reverse-ordered data causes many shifts, producing quadratic work."
  },
  merge: {
    algorithm: "merge",
    bestTime: "O(n log n)",
    averageTime: "O(n log n)",
    worstTime: "O(n log n)",
    space: "O(n)",
    stable: true,
    inPlace: false,
    strengths: "Predictable O(n log n) time and stability make it strong for large datasets and external sorting.",
    caution: "Its temporary arrays require extra memory compared with in-place sorts."
  },
  quick: {
    algorithm: "quick",
    bestTime: "O(n log n)",
    averageTime: "O(n log n)",
    worstTime: "O(n²)",
    space: "O(log n) avg; O(n) worst",
    stable: false,
    inPlace: true,
    strengths: "Usually very fast in practice because partitioning has good locality and low constant overhead.",
    caution: "Poor pivot splits can degrade to O(n²); this lab uses the final element as the pivot."
  },
  heap: {
    algorithm: "heap",
    bestTime: "O(n log n)",
    averageTime: "O(n log n)",
    worstTime: "O(n log n)",
    space: "O(1)",
    stable: false,
    inPlace: true,
    strengths: "Guarantees O(n log n) time while using constant auxiliary space.",
    caution: "Often has less cache-friendly access patterns and larger constants than Quick Sort in practice."
  }
};

export function getSortLearningProfile(algorithm: SortAlgorithm): SortLearningProfile {
  return PROFILES[algorithm];
}

export function rankSortWork(entries: SortComparisonEntry[]): SortWorkRanking[] {
  const scored = entries.map(entry => ({ entry, workScore: entry.comparisons + entry.writes }));
  const orderedScores = [...new Set(scored.map(item => item.workScore))].sort((a, b) => a - b);
  const best = orderedScores[0] ?? Infinity;
  return scored.map(item => ({
    ...item,
    rank: orderedScores.indexOf(item.workScore) + 1,
    winner: item.workScore === best
  }));
}

export function explainWorkWinner(ranking: SortWorkRanking[]): string {
  const winners = ranking.filter(item => item.winner);
  if (!winners.length) return "No algorithms were compared.";
  const names = winners.map(item => item.entry.algorithm).join(" and ");
  const score = winners[0].workScore;
  return `${names} ${winners.length === 1 ? "wins" : "tie"} this exact input with the lowest work score (${score}). Work score = comparisons + writes; it is a teaching heuristic, not wall-clock runtime.`;
}
