import { describe, expect, it } from "vitest";
import {
  INITIAL_PAGE_RESIDENCY,
  MEMORY_JOURNEY_CONFIG,
  PAGE_TABLE,
  decodeCacheAddress,
  memoryPatternIndices,
  simulateMemoryJourney,
  translateVirtualAddress
} from "./memoryJourneyModel";

describe("memory journey model", () => {
  it("splits a virtual address into page and offset then maps to a physical frame", () => {
    const result = translateVirtualAddress(70);
    expect(result.virtualPage).toBe(1);
    expect(result.pageOffset).toBe(6);
    expect(result.physicalFrame).toBe(PAGE_TABLE[1]);
    expect(result.physicalAddress).toBe(PAGE_TABLE[1] * MEMORY_JOURNEY_CONFIG.pageSizeBytes + 6);
  });

  it("decodes a physical address into direct-mapped cache fields", () => {
    const decoded = decodeCacheAddress(336);
    expect(decoded.cacheBlock).toBe(21);
    expect(decoded.cacheSet).toBe(1);
    expect(decoded.cacheTag).toBe(5);
    expect(decoded.cacheOffset).toBe(0);
  });

  it("shows the TLB fast path after the first translation of a page", () => {
    const run = simulateMemoryJourney("sequential", 48);
    expect(run.steps[0].tlbHit).toBe(false);
    expect(run.steps[0].pageTableAccessed).toBe(true);
    expect(run.steps[1].tlbHit).toBe(true);
    expect(run.steps[1].pageTableAccessed).toBe(false);
    expect(run.tlbHits).toBeGreaterThan(0);
    expect(run.steps[0].tlbEntries).not.toBe(run.steps[1].tlbEntries);
  });

  it("takes a page-fault branch once, makes the page resident, and continues", () => {
    expect(INITIAL_PAGE_RESIDENCY[6]).toBe(false);
    const run = simulateMemoryJourney("page-hop", 48);
    const faults = run.steps.filter(step => step.pageFault);
    expect(faults).toHaveLength(1);
    expect(faults[0].translation.virtualPage).toBe(6);
    expect(faults[0].residentPages[6]).toBe(true);
    expect(run.pageFaults).toBe(1);
    const laterVpn6 = run.steps.find(step => step.step > faults[0].step && step.translation.virtualPage === 6);
    if (laterVpn6) expect(laterVpn6.pageFault).toBe(false);
  });

  it("keeps TLB snapshots immutable across the trace", () => {
    const run = simulateMemoryJourney("page-hop", 48);
    const first = run.steps[0].tlbEntries.map(entry => entry ? { ...entry } : null);
    expect(run.steps[0].tlbEntries).not.toBe(run.steps[1].tlbEntries);
    expect(run.steps[0].tlbEntries).toEqual(first);
  });

  it("shows spatial locality for sequential array access", () => {
    const run = simulateMemoryJourney("sequential", 48);
    expect(run.steps).toHaveLength(16);
    expect(run.hits).toBeGreaterThan(run.misses);
    expect(run.steps.some(step => step.translation.virtualPage === 1)).toBe(true);
    expect(run.steps[0].cacheTags).not.toBe(run.steps[1].cacheTags);
  });

  it("makes page hopping produce more cache misses and translation misses than sequential access", () => {
    const sequential = simulateMemoryJourney("sequential", 48);
    const hopping = simulateMemoryJourney("page-hop", 48);
    expect(hopping.misses).toBeGreaterThan(sequential.misses);
    expect(hopping.tlbMisses).toBeGreaterThan(sequential.tlbMisses);
    expect(memoryPatternIndices("page-hop")).toHaveLength(16);
  });

  it("bounds virtual addresses and base addresses", () => {
    expect(translateVirtualAddress(Number.POSITIVE_INFINITY).virtualAddress).toBe(0);
    expect(translateVirtualAddress(99999).virtualPage).toBe(7);
    const run = simulateMemoryJourney("sequential", 9999);
    expect(run.steps.every(step => step.translation.virtualPage < MEMORY_JOURNEY_CONFIG.virtualPageCount)).toBe(true);
    expect(run.steps.every(step => step.tlbIndex < MEMORY_JOURNEY_CONFIG.tlbEntryCount)).toBe(true);
  });
});
