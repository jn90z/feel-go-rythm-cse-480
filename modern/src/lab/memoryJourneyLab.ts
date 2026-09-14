import "./memoryJourneyLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  INITIAL_PAGE_RESIDENCY,
  MEMORY_JOURNEY_CONFIG,
  PAGE_TABLE,
  simulateMemoryJourney,
  type MemoryJourneyRun,
  type MemoryPattern
} from "./memoryJourneyModel";

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

type Prediction = "tlb-hit" | "tlb-miss" | "page-fault";

interface MemoryJourneySeed {
  baseAddress: number;
  index: number;
  effectiveAddress: number;
}

function readMemoryJourneySeed(host: HTMLElement): MemoryJourneySeed | null {
  const parts = host.dataset.memoryJourneySeed?.split(":").map(Number);
  if (!parts || parts.length !== 3 || parts.some(value => !Number.isFinite(value))) return null;
  const [baseAddress, index, effectiveAddress] = parts.map(Math.trunc);
  if (baseAddress < 0 || baseAddress > 63 || index < 0 || index > 15) return null;
  if (effectiveAddress !== baseAddress + index * MEMORY_JOURNEY_CONFIG.elementBytes) return null;
  return { baseAddress, index, effectiveAddress };
}

function renderMemoryJourneyLab(host: HTMLElement): () => void {
  const seed = readMemoryJourneySeed(host);
  const baseAddress = seed?.baseAddress ?? 48;

  host.innerHTML = `
    <div class="lab-module memory-journey-lab">
      <section class="lab-panel memory-journey-hero">
        <div>
          <span class="memory-journey-kicker">X-Ray Mode · one load, every layer</span>
          <h3>Memory Journey: from C++ index to CPU cache</h3>
          <p class="lab-note">Follow one array read through address translation and caching. The fast path can stop at the TLB; a miss consults the page table; a non-resident page traps into the OS before the CPU can continue.</p>
          <p class="lab-note" data-memory-origin hidden></p>
        </div>
        <div class="memory-journey-formula">arr[i] → virtual → TLB → page table / OS → physical → cache → value</div>
      </section>

      <section class="lab-panel memory-journey-controls">
        <label>Access pattern
          <select data-memory-pattern>
            <option value="sequential">Sequential arr[i]</option>
            <option value="page-hop">Page-hopping stride</option>
          </select>
        </label>
        <div class="memory-journey-playback">
          <button type="button" data-memory-prev>Previous</button>
          <button type="button" data-memory-play>Play</button>
          <button type="button" data-memory-next>Next</button>
        </div>
        <span data-memory-step-label></span>
      </section>

      <section class="lab-panel memory-journey-source">
        <div>
          <span class="memory-journey-kicker">1 · What the programmer wrote</span>
          <pre data-memory-code></pre>
        </div>
        <div class="memory-journey-source-value">
          <span>Current index</span><strong data-memory-index></strong>
          <small data-memory-base></small>
        </div>
      </section>

      <section class="lab-panel memory-journey-pipeline" aria-live="polite">
        <span class="memory-journey-kicker">2 · What the machine does</span>
        <div class="memory-journey-chain">
          <div class="memory-journey-stage"><span>Virtual address</span><strong data-memory-va></strong><small data-memory-va-equation></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>VPN + offset</span><strong data-memory-vpn></strong><small data-memory-page-offset></small></div>
          <b>→</b>
          <div class="memory-journey-stage" data-memory-tlb-stage><span>TLB lookup</span><strong data-memory-tlb-result></strong><small data-memory-tlb-detail></small></div>
          <b>→</b>
          <div class="memory-journey-stage" data-memory-walk-stage><span>Slow path</span><strong data-memory-walk-result></strong><small data-memory-walk-detail></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Physical address</span><strong data-memory-pa></strong><small data-memory-pa-equation></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Cache decode</span><strong data-memory-cache-fields></strong><small data-memory-cache-offset></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Result</span><strong data-memory-result></strong><small data-memory-result-detail></small></div>
        </div>
      </section>

      <section class="memory-journey-grid memory-journey-three-grid">
        <div class="lab-panel">
          <span class="memory-journey-kicker">3 · Translation lookaside buffer</span>
          <div class="memory-journey-tlb" data-memory-tlb></div>
          <p class="lab-note">The TLB is a tiny cache of recent virtual-page → physical-frame translations. A hit avoids a page-table lookup entirely.</p>
        </div>
        <div class="lab-panel">
          <span class="memory-journey-kicker">4 · Page table + residency</span>
          <div class="memory-journey-page-table" data-memory-page-table></div>
          <p class="lab-note">VPN 6 begins non-resident. Its first access demonstrates a page fault: the hardware traps into the OS, the page becomes resident, and execution resumes.</p>
        </div>
        <div class="lab-panel">
          <span class="memory-journey-kicker">5 · Direct-mapped cache</span>
          <div class="memory-journey-cache" data-memory-cache></div>
          <p class="lab-note">After translation, the physical cache block chooses a cache set. The tag determines whether the desired block is already nearby.</p>
        </div>
      </section>

      <section class="lab-panel memory-journey-predict">
        <div>
          <span class="memory-journey-kicker">Predict before reveal</span>
          <strong>Which translation path will the next access take?</strong>
          <p class="lab-note" data-memory-predict-prompt></p>
        </div>
        <div class="memory-journey-predict-actions">
          <button type="button" data-memory-predict="tlb-hit">TLB hit</button>
          <button type="button" data-memory-predict="tlb-miss">TLB miss</button>
          <button type="button" data-memory-predict="page-fault">Page fault</button>
        </div>
        <p data-memory-feedback aria-live="polite"></p>
      </section>

      <section class="lab-panel">
        <input class="memory-journey-timeline" data-memory-timeline type="range" min="0" max="15" value="0" aria-label="Memory access timeline" />
        <div class="memory-journey-compare" data-memory-compare></div>
      </section>

      <section class="lab-panel memory-journey-takeaway">
        <strong>The fast path and slow path are the same load</strong>
        <p class="lab-note">Most memory diagrams isolate virtual memory, the TLB, page tables, page faults, and CPU caches. This X-Ray keeps them connected. A TLB hit skips the page table. A TLB miss performs a page-table lookup. If the page is absent, the CPU traps to the OS before translation can finish. Only then does the physical address reach the CPU cache.</p>
      </section>
    </div>`;

  const controller = new AbortController();
  const signal = controller.signal;
  const patternSelect = host.querySelector<HTMLSelectElement>("[data-memory-pattern]")!;
  const timeline = host.querySelector<HTMLInputElement>("[data-memory-timeline]")!;
  const playButton = host.querySelector<HTMLButtonElement>("[data-memory-play]")!;
  let step = seed?.index ?? 0;
  let timer: number | null = null;

  host.querySelector<HTMLElement>("[data-memory-base]")!.textContent = `4-byte int · base virtual address ${baseAddress}`;
  if (seed) {
    const origin = host.querySelector<HTMLElement>("[data-memory-origin]")!;
    origin.hidden = false;
    origin.textContent = `Continued from Source-to-Silicon: values[${seed.index}] produced virtual address ${seed.effectiveAddress} (0x${seed.effectiveAddress.toString(16).padStart(4, "0")}). The same load is highlighted below.`;
  }

  const currentRun = (): MemoryJourneyRun => simulateMemoryJourney(patternSelect.value as MemoryPattern, baseAddress);

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playButton.textContent = "Play";
  };

  const clearPrediction = () => {
    host.querySelector<HTMLElement>("[data-memory-feedback]")!.textContent = "";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(button => button.setAttribute("aria-pressed", "false"));
  };

  const renderTlb = (run: MemoryJourneyRun) => {
    const target = host.querySelector<HTMLElement>("[data-memory-tlb]")!;
    const current = run.steps[step];
    target.replaceChildren();
    current.tlbEntries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "memory-journey-tlb-row";
      if (index === current.tlbIndex) row.classList.add("is-active");
      const slot = document.createElement("strong");
      slot.textContent = `Slot ${index}`;
      const value = document.createElement("span");
      value.textContent = entry ? `VPN ${entry.virtualPage} → frame ${entry.physicalFrame}` : "empty";
      row.append(slot, value);
      target.append(row);
    });
  };

  const renderPageTable = (run: MemoryJourneyRun) => {
    const target = host.querySelector<HTMLElement>("[data-memory-page-table]")!;
    const current = run.steps[step];
    target.replaceChildren();
    PAGE_TABLE.forEach((frame, page) => {
      const row = document.createElement("div");
      row.className = "memory-journey-page-row";
      if (page === current.translation.virtualPage) row.classList.add("is-active");
      if (!current.residentPages[page]) row.classList.add("is-nonresident");
      if (page === current.translation.virtualPage && current.pageFault) row.classList.add("is-fault");
      const vpn = document.createElement("strong");
      vpn.textContent = `VPN ${page}`;
      const arrow = document.createElement("span");
      arrow.textContent = current.residentPages[page] ? "→" : "↯";
      const pfn = document.createElement("span");
      pfn.textContent = current.residentPages[page]
        ? `frame ${frame}`
        : INITIAL_PAGE_RESIDENCY[page] ? `frame ${frame}` : "not resident";
      row.append(vpn, arrow, pfn);
      target.append(row);
    });
  };

  const renderCache = (run: MemoryJourneyRun) => {
    const target = host.querySelector<HTMLElement>("[data-memory-cache]")!;
    const current = run.steps[step];
    target.replaceChildren();
    current.cacheTags.forEach((tag, set) => {
      const row = document.createElement("div");
      row.className = "memory-journey-cache-row";
      if (set === current.cache.cacheSet) row.classList.add("is-active");
      const label = document.createElement("strong");
      label.textContent = `Set ${set}`;
      const value = document.createElement("span");
      value.textContent = tag === null ? "empty" : `tag ${tag}`;
      row.append(label, value);
      target.append(row);
    });
  };

  const renderComparison = () => {
    const target = host.querySelector<HTMLElement>("[data-memory-compare]")!;
    target.replaceChildren();
    ([simulateMemoryJourney("sequential", baseAddress), simulateMemoryJourney("page-hop", baseAddress)] as MemoryJourneyRun[]).forEach(run => {
      const card = document.createElement("div");
      card.className = "memory-journey-compare-card";
      const title = document.createElement("strong");
      title.textContent = run.pattern === "sequential" ? "Sequential" : "Page hopping";
      const cacheRate = document.createElement("b");
      cacheRate.textContent = `${pct(run.hitRate)} cache hit rate`;
      const tlbRate = document.createElement("span");
      tlbRate.textContent = `${pct(run.tlbHitRate)} TLB hit rate · ${run.tlbMisses} translation misses`;
      const faultDetail = document.createElement("span");
      faultDetail.textContent = `${run.pageFaults} page fault${run.pageFaults === 1 ? "" : "s"}`;
      card.append(title, cacheRate, tlbRate, faultDetail);
      target.append(card);
    });
  };

  const draw = () => {
    const run = currentRun();
    step = Math.max(0, Math.min(run.steps.length - 1, step));
    const current = run.steps[step];
    timeline.value = String(step);
    host.querySelector<HTMLElement>("[data-memory-step-label]")!.textContent = `Access ${step + 1} / ${run.steps.length}`;
    host.querySelector<HTMLElement>("[data-memory-code]")!.textContent = run.pattern === "sequential"
      ? "for (int i = 0; i < 16; ++i)\n    sum += arr[i];"
      : "for (int i = 0; i < 16; ++i)\n    sum += arr[(i * 16) % 112];";
    host.querySelector<HTMLElement>("[data-memory-index]")!.textContent = String(current.sourceIndex);
    host.querySelector<HTMLElement>("[data-memory-va]")!.textContent = String(current.translation.virtualAddress);
    host.querySelector<HTMLElement>("[data-memory-va-equation]")!.textContent = `${baseAddress} + ${current.sourceIndex} × 4 bytes`;
    host.querySelector<HTMLElement>("[data-memory-vpn]")!.textContent = `VPN ${current.translation.virtualPage}`;
    host.querySelector<HTMLElement>("[data-memory-page-offset]")!.textContent = `offset ${current.translation.pageOffset}`;

    const tlbResult = host.querySelector<HTMLElement>("[data-memory-tlb-result]")!;
    tlbResult.textContent = current.tlbHit ? "TLB HIT" : "TLB MISS";
    tlbResult.className = current.tlbHit ? "is-hit" : "is-miss";
    host.querySelector<HTMLElement>("[data-memory-tlb-detail]")!.textContent = current.tlbHit
      ? `slot ${current.tlbIndex} supplies frame ${current.translation.physicalFrame}`
      : `slot ${current.tlbIndex} cannot supply VPN ${current.translation.virtualPage}`;

    const walkResult = host.querySelector<HTMLElement>("[data-memory-walk-result]")!;
    const walkStage = host.querySelector<HTMLElement>("[data-memory-walk-stage]")!;
    walkStage.classList.toggle("is-fault", current.pageFault);
    if (current.tlbHit) {
      walkResult.textContent = "SKIPPED";
      walkResult.className = "is-muted";
      host.querySelector<HTMLElement>("[data-memory-walk-detail]")!.textContent = "no page-table access";
    } else if (current.pageFault) {
      walkResult.textContent = "PAGE FAULT";
      walkResult.className = "is-fault";
      host.querySelector<HTMLElement>("[data-memory-walk-detail]")!.textContent = `trap to OS → load VPN ${current.translation.virtualPage} → frame ${current.translation.physicalFrame}`;
    } else {
      walkResult.textContent = "PAGE TABLE";
      walkResult.className = "is-walk";
      host.querySelector<HTMLElement>("[data-memory-walk-detail]")!.textContent = `PTE[${current.translation.virtualPage}] → frame ${current.translation.physicalFrame}`;
    }

    host.querySelector<HTMLElement>("[data-memory-pa]")!.textContent = String(current.translation.physicalAddress);
    host.querySelector<HTMLElement>("[data-memory-pa-equation]")!.textContent = `${current.translation.physicalFrame} × ${MEMORY_JOURNEY_CONFIG.pageSizeBytes} + ${current.translation.pageOffset}`;
    host.querySelector<HTMLElement>("[data-memory-cache-fields]")!.textContent = `tag ${current.cache.cacheTag} · set ${current.cache.cacheSet}`;
    host.querySelector<HTMLElement>("[data-memory-cache-offset]")!.textContent = `line offset ${current.cache.cacheOffset}`;
    const result = host.querySelector<HTMLElement>("[data-memory-result]")!;
    result.textContent = current.hit ? "CACHE HIT" : "CACHE MISS";
    result.className = current.hit ? "is-hit" : "is-miss";
    host.querySelector<HTMLElement>("[data-memory-result-detail]")!.textContent = current.hit
      ? `set ${current.cache.cacheSet} already has tag ${current.cache.cacheTag}`
      : current.evictedTag === null
        ? `load tag ${current.cache.cacheTag} into set ${current.cache.cacheSet}`
        : `replace tag ${current.evictedTag} with ${current.cache.cacheTag} in set ${current.cache.cacheSet}`;

    const next = run.steps[step + 1];
    host.querySelector<HTMLElement>("[data-memory-predict-prompt]")!.textContent = next
      ? `Next arr[${next.sourceIndex}] creates VPN ${next.translation.virtualPage}. Does translation stay in the TLB, walk the page table, or trap to the OS?`
      : "End of trace. Scrub backward to make another prediction.";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(button => { button.disabled = !next; });
    renderTlb(run);
    renderPageTable(run);
    renderCache(run);
    renderComparison();
  };

  const moveTo = (value: number) => {
    const run = currentRun();
    step = Math.max(0, Math.min(run.steps.length - 1, value));
    clearPrediction();
    draw();
  };

  patternSelect.addEventListener("change", () => { stop(); step = 0; clearPrediction(); draw(); }, { signal });
  timeline.addEventListener("input", () => { stop(); moveTo(Number(timeline.value)); }, { signal });
  host.querySelector<HTMLButtonElement>("[data-memory-prev]")!.addEventListener("click", () => { stop(); moveTo(step - 1); }, { signal });
  host.querySelector<HTMLButtonElement>("[data-memory-next]")!.addEventListener("click", () => { stop(); moveTo(step + 1); }, { signal });
  playButton.addEventListener("click", () => {
    if (timer !== null) { stop(); return; }
    playButton.textContent = "Pause";
    timer = window.setInterval(() => {
      const last = currentRun().steps.length - 1;
      if (step >= last) { stop(); return; }
      moveTo(step + 1);
    }, 750);
  }, { signal });
  host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(button => button.addEventListener("click", () => {
    const next = currentRun().steps[step + 1];
    if (!next) return;
    const guess = button.dataset.memoryPredict as Prediction | undefined;
    const answer: Prediction = next.pageFault ? "page-fault" : next.tlbHit ? "tlb-hit" : "tlb-miss";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(candidate => candidate.setAttribute("aria-pressed", String(candidate === button)));
    const path = answer === "tlb-hit"
      ? `TLB slot ${next.tlbIndex} already contains VPN ${next.translation.virtualPage} → frame ${next.translation.physicalFrame}, so the page table is skipped.`
      : answer === "page-fault"
        ? `The TLB misses and VPN ${next.translation.virtualPage} is not resident, so hardware traps into the OS before installing the translation.`
        : `The TLB misses, but VPN ${next.translation.virtualPage} is resident; the page table supplies frame ${next.translation.physicalFrame} and the TLB is filled.`;
    host.querySelector<HTMLElement>("[data-memory-feedback]")!.textContent = guess === answer
      ? `Correct. ${path}`
      : `Not this time. ${path}`;
  }, { signal }));

  draw();
  return () => { stop(); controller.abort(); };
}

registerLabModule({
  id: "memory-journey",
  icon: "🔬",
  title: "Memory Journey X-Ray",
  description: "Trace one C++ array access through the TLB fast path, page table, page faults, physical memory, and CPU cache.",
  featured: true,
  render: renderMemoryJourneyLab
});
