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

export interface TlbEntry {
  virtualPage: number;
  physicalFrame: number;
}

export interface MemoryJourneyStep {
  step: number;
  sourceIndex: number;
  translation: PageTranslation;
  tlbIndex: number;
  tlbHit: boolean;
  pageTableAccessed: boolean;
  pageFault: boolean;
  tlbEntries: Array<TlbEntry | null>;
  residentPages: boolean[];
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
  tlbHits: number;
  tlbMisses: number;
  tlbHitRate: number;
  pageFaults: number;
}

export const MEMORY_JOURNEY_CONFIG = {
  elementBytes: 4,
  pageSizeBytes: 64,
  virtualPageCount: 8,
  tlbEntryCount: 4,
  cacheLineBytes: 16,
  cacheSetCount: 4
} as const;

// Deliberately non-identity mapping so students can see virtual pages are not physical frames.
export const PAGE_TABLE: readonly number[] = [2, 5, 1, 7, 0, 6, 3, 4];

// VPN 6 starts on backing storage so the page-hopping trace demonstrates a real page fault.
export const INITIAL_PAGE_RESIDENCY: readonly boolean[] = [true, true, true, true, true, true, false, true];

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
  const tlb: Array<TlbEntry | null> = Array.from({ length: MEMORY_JOURNEY_CONFIG.tlbEntryCount }, () => null);
  const residentPages = [...INITIAL_PAGE_RESIDENCY];
  const steps: MemoryJourneyStep[] = [];
  let hits = 0;
  let misses = 0;
  let tlbHits = 0;
  let tlbMisses = 0;
  let pageFaults = 0;

  memoryPatternIndices(pattern).forEach((sourceIndex, step) => {
    const virtualAddress = safeBase + sourceIndex * MEMORY_JOURNEY_CONFIG.elementBytes;
    const translation = translateVirtualAddress(virtualAddress);

    const tlbIndex = translation.virtualPage % MEMORY_JOURNEY_CONFIG.tlbEntryCount;
    const cachedTranslation = tlb[tlbIndex];
    const tlbHit = cachedTranslation?.virtualPage === translation.virtualPage
      && cachedTranslation.physicalFrame === translation.physicalFrame
      && residentPages[translation.virtualPage];
    const pageTableAccessed = !tlbHit;
    const pageFault = pageTableAccessed && !residentPages[translation.virtualPage];

    if (tlbHit) tlbHits += 1;
    else {
      tlbMisses += 1;
      if (pageFault) {
        pageFaults += 1;
        residentPages[translation.virtualPage] = true;
      }
      tlb[tlbIndex] = {
        virtualPage: translation.virtualPage,
        physicalFrame: translation.physicalFrame
      };
    }

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
      tlbIndex,
      tlbHit,
      pageTableAccessed,
      pageFault,
      tlbEntries: tlb.map(entry => entry ? { ...entry } : null),
      residentPages: [...residentPages],
      cache,
      hit,
      evictedTag,
      cacheTags: [...tags]
    });
  });

  return {
    pattern,
    steps,
    hits,
    misses,
    hitRate: steps.length ? hits / steps.length : 0,
    tlbHits,
    tlbMisses,
    tlbHitRate: steps.length ? tlbHits / steps.length : 0,
    pageFaults
  };
}
