export type PagePolicy = "fifo" | "lru" | "optimal";

export interface PageStep {
  index: number;
  page: number;
  frames: Array<number | null>;
  hit: boolean;
  evicted: number | null;
  explanation: string;
}

export interface PageResult {
  policy: PagePolicy;
  frameCount: number;
  references: number[];
  steps: PageStep[];
  faults: number;
  hits: number;
  hitRate: number;
}

const MAX_REFERENCES = 80;
const MIN_FRAMES = 1;
const MAX_FRAMES = 8;

export function parseReferences(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 999)
    .slice(0, MAX_REFERENCES);
}

function clampFrames(frameCount: number): number {
  if (!Number.isFinite(frameCount)) return 3;
  return Math.max(MIN_FRAMES, Math.min(MAX_FRAMES, Math.floor(frameCount)));
}

export function simulatePageReplacement(references: number[], policy: PagePolicy, requestedFrames = 3): PageResult {
  const frameCount = clampFrames(requestedFrames);
  const refs = references.slice(0, MAX_REFERENCES);
  const frames: Array<number | null> = Array(frameCount).fill(null);
  const loadedAt = new Map<number, number>();
  const lastUsed = new Map<number, number>();
  const steps: PageStep[] = [];
  let faults = 0;
  let hits = 0;

  refs.forEach((page, index) => {
    const existing = frames.indexOf(page);
    if (existing >= 0) {
      hits += 1;
      lastUsed.set(page, index);
      steps.push({ index, page, frames: [...frames], hit: true, evicted: null, explanation: `Page ${page} is already resident in frame ${existing + 1}, so this reference is a hit.` });
      return;
    }

    faults += 1;
    let slot = frames.indexOf(null);
    let evicted: number | null = null;
    if (slot < 0) {
      if (policy === "fifo") {
        slot = frames.reduce<number>((best, value, candidate) => (loadedAt.get(value!)! < loadedAt.get(frames[best]!)! ? candidate : best), 0);
      } else if (policy === "lru") {
        slot = frames.reduce<number>((best, value, candidate) => (lastUsed.get(value!)! < lastUsed.get(frames[best]!)! ? candidate : best), 0);
      } else {
        const nextUse = (value: number): number => {
          const offset = refs.slice(index + 1).indexOf(value);
          return offset < 0 ? Number.POSITIVE_INFINITY : index + 1 + offset;
        };
        slot = frames.reduce<number>((best, value, candidate) => (nextUse(value!) > nextUse(frames[best]!) ? candidate : best), 0);
      }
      evicted = frames[slot];
      if (evicted !== null) {
        loadedAt.delete(evicted);
        lastUsed.delete(evicted);
      }
    }

    frames[slot] = page;
    loadedAt.set(page, index);
    lastUsed.set(page, index);
    const reason = evicted === null
      ? `Page ${page} faults, but an empty frame is available.`
      : policy === "fifo"
        ? `Page ${page} faults. FIFO evicts page ${evicted} because it has been in memory the longest.`
        : policy === "lru"
          ? `Page ${page} faults. LRU evicts page ${evicted} because it was used least recently.`
          : `Page ${page} faults. Optimal evicts page ${evicted} because its next use is farthest in the future (or never).`;
    steps.push({ index, page, frames: [...frames], hit: false, evicted, explanation: reason });
  });

  return { policy, frameCount, references: refs, steps, faults, hits, hitRate: refs.length ? hits / refs.length : 0 };
}

export function comparePagePolicies(references: number[], frameCount = 3): PageResult[] {
  return (["fifo", "lru", "optimal"] as PagePolicy[]).map(policy => simulatePageReplacement(references, policy, frameCount));
}

export function detectBeladyAnomaly(references: number[], lowerFrames: number, upperFrames: number): { lower: PageResult; upper: PageResult; anomaly: boolean } {
  const lower = simulatePageReplacement(references, "fifo", lowerFrames);
  const upper = simulatePageReplacement(references, "fifo", upperFrames);
  return { lower, upper, anomaly: upper.frameCount > lower.frameCount && upper.faults > lower.faults };
}
