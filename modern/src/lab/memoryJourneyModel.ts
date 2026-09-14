export type MemoryPattern = "sequential" | "page-hop";

export interface PageTranslation {
  virtualAddress: number;
  virtualPage: number;
  pageOffset: number;
  physicalFrame: number;
  physicalAddress: number;
}

export interface CacheTranslation {
  cacheBlock: number;
  cacheSet: number;
  cacheTag: number;
  cacheOffset: number;
}

export interface MemoryJourneyStep {
  step: number;
  sourceIndex: number;
  translation: PageTranslation;
  cache: CacheTranslation;
  hit: boolean;
  evictedTag: number | null;
  cacheTags: Array<number | null>;
}

export interface MemoryJourneyRun {
  pattern: MemoryPattern;
  steps: MemoryJourneyStep[];
  hits: number;
  misses: number;
  hitRate: number;
}

export const MEMORY_JOURNEY_CONFIG = {
  elementBytes: 4,
  pageSizeBytes: 64,
  virtualPageCount: 8,
  cacheLineBytes: 16,
  cacheSetCount: 4
} as const;

// Deliberately non-identity mapping so students can see virtual pages are not physical frames.
export const PAGE_TABLE: readonly number[] = [2, 5, 1, 7, 0, 6, 3, 4];

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));

export function normalizeVirtualAddress(address: number): number {
  const max = MEMORY_JOURNEY_CONFIG.pageSizeBytes * MEMORY_JOURNEY_CONFIG.virtualPageCount - 1;
  return clampInt(address, 0, max);
}

export function translateVirtualAddress(address: number): PageTranslation {
  const virtualAddress = normalizeVirtualAddress(address);
  const virtualPage = Math.floor(virtualAddress / MEMORY_JOURNEY_CONFIG.pageSizeBytes);
  const pageOffset = virtualAddress % MEMORY_JOURNEY_CONFIG.pageSizeBytes;
  const physicalFrame = PAGE_TABLE[virtualPage];
  return {
    virtualAddress,
    virtualPage,
    pageOffset,
    physicalFrame,
    physicalAddress: physicalFrame * MEMORY_JOURNEY_CONFIG.pageSizeBytes + pageOffset
  };
}

export function decodeCacheAddress(physicalAddress: number): CacheTranslation {
  const safeAddress = clampInt(physicalAddress, 0, 4095);
  const cacheBlock = Math.floor(safeAddress / MEMORY_JOURNEY_CONFIG.cacheLineBytes);
  const cacheSet = cacheBlock % MEMORY_JOURNEY_CONFIG.cacheSetCount;
  const cacheTag = Math.floor(cacheBlock / MEMORY_JOURNEY_CONFIG.cacheSetCount);
  const cacheOffset = safeAddress % MEMORY_JOURNEY_CONFIG.cacheLineBytes;
  return { cacheBlock, cacheSet, cacheTag, cacheOffset };
}

export function memoryPatternIndices(pattern: MemoryPattern): number[] {
  if (pattern === "page-hop") return Array.from({ length: 16 }, (_, i) => (i * 16) % 112);
  return Array.from({ length: 16 }, (_, i) => i);
}

export function simulateMemoryJourney(pattern: MemoryPattern = "sequential", baseAddress = 48): MemoryJourneyRun {
  const safeBase = clampInt(baseAddress, 0, 63);
  const tags: Array<number | null> = Array.from({ length: MEMORY_JOURNEY_CONFIG.cacheSetCount }, () => null);
  const steps: MemoryJourneyStep[] = [];
  let hits = 0;
  let misses = 0;

  memoryPatternIndices(pattern).forEach((sourceIndex, step) => {
    const virtualAddress = safeBase + sourceIndex * MEMORY_JOURNEY_CONFIG.elementBytes;
    const translation = translateVirtualAddress(virtualAddress);
    const cache = decodeCacheAddress(translation.physicalAddress);
    const previousTag = tags[cache.cacheSet];
    const hit = previousTag === cache.cacheTag;
    const evictedTag = hit || previousTag === null ? null : previousTag;
    if (hit) hits += 1;
    else {
      misses += 1;
      tags[cache.cacheSet] = cache.cacheTag;
    }
    steps.push({
      step,
      sourceIndex,
      translation,
      cache,
      hit,
      evictedTag,
      cacheTags: [...tags]
    });
  });

  return { pattern, steps, hits, misses, hitRate: steps.length ? hits / steps.length : 0 };
}
