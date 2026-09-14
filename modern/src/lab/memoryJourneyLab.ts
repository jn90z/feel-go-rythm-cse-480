import "./memoryJourneyLab.css";
import { registerLabModule } from "./moduleRegistry";
import {
  MEMORY_JOURNEY_CONFIG,
  PAGE_TABLE,
  simulateMemoryJourney,
  type MemoryJourneyRun,
  type MemoryPattern
} from "./memoryJourneyModel";

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

function renderMemoryJourneyLab(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module memory-journey-lab">
      <section class="lab-panel memory-journey-hero">
        <div>
          <span class="memory-journey-kicker">X-Ray Mode · one load, every layer</span>
          <h3>Memory Journey: from C++ index to CPU cache</h3>
          <p class="lab-note">Follow one array read across the abstractions the programmer normally cannot see: virtual memory translates the address, then the cache breaks the physical address into tag, set, and offset.</p>
        </div>
        <div class="memory-journey-formula">arr[i] → virtual → page table → physical → cache → value</div>
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
          <small>4-byte int · base virtual address 48</small>
        </div>
      </section>

      <section class="lab-panel memory-journey-pipeline" aria-live="polite">
        <span class="memory-journey-kicker">2 · What the machine does</span>
        <div class="memory-journey-chain">
          <div class="memory-journey-stage"><span>Virtual address</span><strong data-memory-va></strong><small data-memory-va-equation></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Virtual page + offset</span><strong data-memory-vpn></strong><small data-memory-page-offset></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Page table</span><strong data-memory-frame></strong><small data-memory-pte></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Physical address</span><strong data-memory-pa></strong><small data-memory-pa-equation></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Cache decode</span><strong data-memory-cache-fields></strong><small data-memory-cache-offset></small></div>
          <b>→</b>
          <div class="memory-journey-stage"><span>Result</span><strong data-memory-result></strong><small data-memory-result-detail></small></div>
        </div>
      </section>

      <section class="memory-journey-grid">
        <div class="lab-panel">
          <span class="memory-journey-kicker">3 · Page table translation</span>
          <div class="memory-journey-page-table" data-memory-page-table></div>
          <p class="lab-note">The virtual page number selects a page-table entry. The page offset is preserved; only the page number changes into a physical frame number.</p>
        </div>
        <div class="lab-panel">
          <span class="memory-journey-kicker">4 · Direct-mapped cache</span>
          <div class="memory-journey-cache" data-memory-cache></div>
          <p class="lab-note">The physical cache block chooses exactly one cache set. The tag tells the CPU which memory block is currently stored there.</p>
        </div>
      </section>

      <section class="lab-panel memory-journey-predict">
        <div>
          <span class="memory-journey-kicker">Predict before reveal</span>
          <strong>What happens on the next array access?</strong>
          <p class="lab-note" data-memory-predict-prompt></p>
        </div>
        <div class="memory-journey-predict-actions">
          <button type="button" data-memory-predict="hit">Cache hit</button>
          <button type="button" data-memory-predict="miss">Cache miss</button>
        </div>
        <p data-memory-feedback aria-live="polite"></p>
      </section>

      <section class="lab-panel">
        <input class="memory-journey-timeline" data-memory-timeline type="range" min="0" max="15" value="0" aria-label="Memory access timeline" />
        <div class="memory-journey-compare" data-memory-compare></div>
      </section>

      <section class="lab-panel memory-journey-takeaway">
        <strong>The connection most diagrams hide</strong>
        <p class="lab-note">Virtual memory and CPU cache solve different problems, but they participate in the same load. The program produces a virtual address; address translation produces a physical address; the cache then decides whether that physical memory block is already nearby. This is why page behavior and cache locality are related parts of one memory hierarchy.</p>
      </section>
    </div>`;

  const controller = new AbortController();
  const signal = controller.signal;
  const patternSelect = host.querySelector<HTMLSelectElement>("[data-memory-pattern]")!;
  const timeline = host.querySelector<HTMLInputElement>("[data-memory-timeline]")!;
  const playButton = host.querySelector<HTMLButtonElement>("[data-memory-play]")!;
  let step = 0;
  let timer: number | null = null;

  const currentRun = (): MemoryJourneyRun => simulateMemoryJourney(patternSelect.value as MemoryPattern, 48);

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playButton.textContent = "Play";
  };

  const clearPrediction = () => {
    host.querySelector<HTMLElement>("[data-memory-feedback]")!.textContent = "";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(button => button.setAttribute("aria-pressed", "false"));
  };

  const renderPageTable = (run: MemoryJourneyRun) => {
    const target = host.querySelector<HTMLElement>("[data-memory-page-table]")!;
    const current = run.steps[step];
    target.replaceChildren();
    PAGE_TABLE.forEach((frame, page) => {
      const row = document.createElement("div");
      row.className = "memory-journey-page-row";
      if (page === current.translation.virtualPage) row.classList.add("is-active");
      const vpn = document.createElement("strong");
      vpn.textContent = `VPN ${page}`;
      const arrow = document.createElement("span");
      arrow.textContent = "→";
      const pfn = document.createElement("span");
      pfn.textContent = `frame ${frame}`;
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
    ([simulateMemoryJourney("sequential", 48), simulateMemoryJourney("page-hop", 48)] as MemoryJourneyRun[]).forEach(run => {
      const card = document.createElement("div");
      card.className = "memory-journey-compare-card";
      const title = document.createElement("strong");
      title.textContent = run.pattern === "sequential" ? "Sequential" : "Page hopping";
      const rate = document.createElement("b");
      rate.textContent = `${pct(run.hitRate)} cache hit rate`;
      const detail = document.createElement("span");
      detail.textContent = `${run.hits} hits · ${run.misses} misses`;
      card.append(title, rate, detail);
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
    host.querySelector<HTMLElement>("[data-memory-va-equation]")!.textContent = `48 + ${current.sourceIndex} × 4 bytes`;
    host.querySelector<HTMLElement>("[data-memory-vpn]")!.textContent = `VPN ${current.translation.virtualPage}`;
    host.querySelector<HTMLElement>("[data-memory-page-offset]")!.textContent = `offset ${current.translation.pageOffset}`;
    host.querySelector<HTMLElement>("[data-memory-frame]")!.textContent = `frame ${current.translation.physicalFrame}`;
    host.querySelector<HTMLElement>("[data-memory-pte]")!.textContent = `PTE[${current.translation.virtualPage}] = ${current.translation.physicalFrame}`;
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
      ? `Next arr[${next.sourceIndex}] creates virtual address ${next.translation.virtualAddress}. Will its physical block already be cached?`
      : "End of trace. Scrub backward to make another prediction.";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(button => { button.disabled = !next; });
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
    const guess = button.dataset.memoryPredict;
    const answer = next.hit ? "hit" : "miss";
    host.querySelectorAll<HTMLButtonElement>("[data-memory-predict]").forEach(candidate => candidate.setAttribute("aria-pressed", String(candidate === button)));
    host.querySelector<HTMLElement>("[data-memory-feedback]")!.textContent = guess === answer
      ? `Correct. VPN ${next.translation.virtualPage} maps to frame ${next.translation.physicalFrame}; physical address ${next.translation.physicalAddress} decodes to set ${next.cache.cacheSet}, tag ${next.cache.cacheTag}, producing a ${answer}.`
      : `Follow the full chain: VPN ${next.translation.virtualPage} → frame ${next.translation.physicalFrame} → physical ${next.translation.physicalAddress} → set ${next.cache.cacheSet}, tag ${next.cache.cacheTag}. It will be a ${answer}.`;
  }, { signal }));

  draw();
  return () => { stop(); controller.abort(); };
}

registerLabModule({
  id: "memory-journey",
  icon: "🔬",
  title: "Memory Journey X-Ray",
  description: "Trace one C++ array access through virtual pages, physical frames, cache tag/set/offset, and the final hit or miss.",
  featured: true,
  render: renderMemoryJourneyLab
});
