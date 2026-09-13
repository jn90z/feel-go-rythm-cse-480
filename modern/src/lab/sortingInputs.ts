export type SortInputShape = "random" | "sorted" | "reverse" | "nearly-sorted" | "duplicates";

const DESCRIPTIONS: Record<SortInputShape, string> = {
  random: "Random order is a good general-purpose case for comparing typical behavior.",
  sorted: "Already sorted data exposes best-case opportunities and worst-case pivot choices in some implementations.",
  reverse: "Reverse order is highly disordered and stresses algorithms that move values incrementally.",
  "nearly-sorted": "Nearly sorted data contains only a few misplaced values, which can strongly favor adaptive algorithms such as Insertion Sort.",
  duplicates: "Many duplicates show how algorithms behave when equal keys are common and make stability easier to discuss."
};

function ascending(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function randomIndex(limit: number, random: () => number): number {
  return Math.min(limit - 1, Math.floor(random() * limit));
}

export function generateSortInput(
  requestedCount: number,
  shape: SortInputShape,
  random: () => number = Math.random
): number[] {
  const count = Math.max(0, Math.floor(requestedCount));
  const values = ascending(count);
  if (count < 2) return values;

  if (shape === "sorted") return values;
  if (shape === "reverse") return values.reverse();

  if (shape === "duplicates") {
    const distinctValues = Math.max(2, Math.min(count, Math.ceil(Math.sqrt(count))));
    return Array.from({ length: count }, () => randomIndex(distinctValues, random) + 1);
  }

  if (shape === "nearly-sorted") {
    const swaps = Math.max(1, Math.floor(count / 8));
    for (let swap = 0; swap < swaps; swap++) {
      const left = randomIndex(count - 1, random);
      const maxDistance = Math.min(3, count - left - 1);
      const distance = Math.max(1, randomIndex(maxDistance, random) + 1);
      const right = left + distance;
      [values[left], values[right]] = [values[right], values[left]];
    }
    return values;
  }

  for (let i = count - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function describeSortInput(shape: SortInputShape): string {
  return DESCRIPTIONS[shape];
}
