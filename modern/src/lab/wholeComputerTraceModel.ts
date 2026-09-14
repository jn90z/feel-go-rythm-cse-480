import {
  MEMORY_JOURNEY_CONFIG,
  simulateMemoryJourney,
  type MemoryJourneyStep
} from "./memoryJourneyModel";
import {
  buildSourceSiliconTrace,
  SOURCE_SILICON_MAX_INDEX,
  type SourceSiliconStage
} from "./sourceSiliconModel";

export type WholeComputerLayer = "source" | "compiler" | "cpu" | "virtual-memory" | "cache";

export interface WholeComputerStage {
  id: string;
  title: string;
  code: string;
  explanation: string;
  layer: WholeComputerLayer;
}

export interface WholeComputerTrace {
  index: number;
  baseAddress: number;
  effectiveAddress: number;
  physicalAddress: number;
  tlbHit: boolean;
  pageTableAccessed: boolean;
  pageFault: boolean;
  cacheHit: boolean;
  memoryStep: MemoryJourneyStep;
  stages: WholeComputerStage[];
}

const layerForSourceStage = (stage: SourceSiliconStage): WholeComputerLayer => {
  if (stage.id === "source" || stage.id === "tokens" || stage.id === "ast") return "source";
  if (stage.id === "ir" || stage.id === "assembly") return "compiler";
  return "cpu";
};

const hex = (value: number): string => `0x${value.toString(16).padStart(4, "0")}`;

export function buildWholeComputerTrace(indexInput: number): WholeComputerTrace {
  const sourceTrace = buildSourceSiliconTrace(indexInput);
  const memoryRun = simulateMemoryJourney("sequential", sourceTrace.baseAddress);
  const memoryStep = memoryRun.steps[sourceTrace.index];

  const sourceStages: WholeComputerStage[] = sourceTrace.stages
    .slice(0, 7)
    .map(stage => ({ ...stage, layer: layerForSourceStage(stage) }));

  const translationPath = memoryStep.tlbHit
    ? `TLB slot ${memoryStep.tlbIndex} already maps VPN ${memoryStep.translation.virtualPage} → frame ${memoryStep.translation.physicalFrame}.`
    : memoryStep.pageFault
      ? `TLB miss → page-table lookup → page fault. The OS makes VPN ${memoryStep.translation.virtualPage} resident in frame ${memoryStep.translation.physicalFrame}, then the load resumes.`
      : `TLB miss → page-table lookup. PTE[${memoryStep.translation.virtualPage}] supplies frame ${memoryStep.translation.physicalFrame}, and the translation is cached in TLB slot ${memoryStep.tlbIndex}.`;

  const cacheResult = memoryStep.hit
    ? `Cache hit in set ${memoryStep.cache.cacheSet}: tag ${memoryStep.cache.cacheTag} is already present.`
    : memoryStep.evictedTag === null
      ? `Cache miss in set ${memoryStep.cache.cacheSet}: the empty set is filled with tag ${memoryStep.cache.cacheTag}.`
      : `Cache miss in set ${memoryStep.cache.cacheSet}: tag ${memoryStep.evictedTag} is evicted and tag ${memoryStep.cache.cacheTag} is installed.`;

  const memoryStages: WholeComputerStage[] = [
    {
      id: "virtual-address",
      title: "8 · Virtual address",
      code: `${hex(sourceTrace.baseAddress)} + ${sourceTrace.index} × ${MEMORY_JOURNEY_CONFIG.elementBytes} = ${hex(memoryStep.translation.virtualAddress)}`,
      explanation: "The effective address produced by the CPU is a virtual address. The memory-management unit must translate it before physical memory is accessed.",
      layer: "virtual-memory"
    },
    {
      id: "tlb",
      title: "9 · TLB lookup",
      code: `VPN ${memoryStep.translation.virtualPage} → slot ${memoryStep.tlbIndex} → ${memoryStep.tlbHit ? "HIT" : "MISS"}`,
      explanation: translationPath,
      layer: "virtual-memory"
    },
    {
      id: "page-table",
      title: "10 · Translation slow path",
      code: memoryStep.tlbHit
        ? "page-table walk skipped"
        : memoryStep.pageFault
          ? `PTE[${memoryStep.translation.virtualPage}] not resident → OS page-fault handler → frame ${memoryStep.translation.physicalFrame}`
          : `PTE[${memoryStep.translation.virtualPage}] → frame ${memoryStep.translation.physicalFrame}`,
      explanation: memoryStep.tlbHit
        ? "The TLB hit supplies the physical frame immediately, so this load does not need a page-table lookup."
        : memoryStep.pageFault
          ? "A missing resident page is much slower than a normal translation miss because execution traps into the operating system before continuing."
          : "The page table resolves the virtual page, then the result can be inserted into the TLB for later accesses.",
      layer: "virtual-memory"
    },
    {
      id: "physical-address",
      title: "11 · Physical address",
      code: `frame ${memoryStep.translation.physicalFrame} × ${MEMORY_JOURNEY_CONFIG.pageSizeBytes} + offset ${memoryStep.translation.pageOffset} = ${hex(memoryStep.translation.physicalAddress)}`,
      explanation: "The translated frame number and unchanged page offset form the physical byte address used by the cache hierarchy.",
      layer: "virtual-memory"
    },
    {
      id: "cache-decode",
      title: "12 · Cache decode",
      code: `block ${memoryStep.cache.cacheBlock} · set ${memoryStep.cache.cacheSet} · tag ${memoryStep.cache.cacheTag} · offset ${memoryStep.cache.cacheOffset}`,
      explanation: "The physical address is divided into cache fields. The set chooses where to look; the tag says which memory block is currently stored there.",
      layer: "cache"
    },
    {
      id: "cache-result",
      title: "13 · Cache result",
      code: `${memoryStep.hit ? "HIT" : "MISS"} in set ${memoryStep.cache.cacheSet}${memoryStep.evictedTag === null ? "" : ` · evict tag ${memoryStep.evictedTag}`}`,
      explanation: cacheResult,
      layer: "cache"
    },
    {
      id: "value",
      title: "14 · Value reaches the CPU",
      code: `load values[${sourceTrace.index}] → EDX\ntotal = total + EDX`,
      explanation: "After translation and caching, the requested 32-bit value finally reaches the register named by the machine instruction and the original source-level addition can complete.",
      layer: "cpu"
    }
  ];

  return {
    index: sourceTrace.index,
    baseAddress: sourceTrace.baseAddress,
    effectiveAddress: sourceTrace.effectiveAddress,
    physicalAddress: memoryStep.translation.physicalAddress,
    tlbHit: memoryStep.tlbHit,
    pageTableAccessed: memoryStep.pageTableAccessed,
    pageFault: memoryStep.pageFault,
    cacheHit: memoryStep.hit,
    memoryStep,
    stages: [...sourceStages, ...memoryStages]
  };
}

export const WHOLE_COMPUTER_MAX_INDEX = SOURCE_SILICON_MAX_INDEX;
