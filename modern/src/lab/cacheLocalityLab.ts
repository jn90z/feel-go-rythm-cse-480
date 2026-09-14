import "./cacheLocalityLab.css";
import { registerLabModule } from "./moduleRegistry";
import { compareTraversal, simulateCache, type CacheSimulation, type TraversalOrder } from "./cacheLocalityModel";

const formatPercent = (value: number): string => `${(value * 100).toFixed(1)}%`;

function renderCacheLocalityLab(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module cache-lab">
      <section class="lab-panel cache-hero">
        <div>
          <span class="cache-kicker">X-Ray Mode · memory hierarchy</span>
          <h3>Cache Locality: same data, different performance</h3>
          <p class="lab-note">A CPU cache loads nearby memory in blocks. Change only the order of a nested loop and the machine can see a completely different stream of hits, misses, and evictions.</p>
        </div>
        <div class="cache-formula">matrix cell → address → block → cache line</div>
      </section>

      <section class="lab-panel cache-controls">
        <label>Traversal
          <select data-cache-order>
            <option value="row-major">Row-major loop</option>
            <option value="column-major">Column-major loop</option>
          </select>
        </label>
        <label>Elements per cache line
          <input data-cache-block type="range" min="1" max="8" step="1" value="4" />
          <strong data-cache-block-value>4</strong>
        </label>
        <label>Cache lines
          <input data-cache-lines type="range" min="1" max="8" step="1" value="2" />
          <strong data-cache-lines-value>2</strong>
        </label>
        <div class="cache-playback">
          <button type="button" data-cache-prev>Previous</button>
          <button type="button" data-cache-play>Play</button>
          <button type="button" data-cache-next>Next</button>
        </div>
      </section>

      <section class="cache-main-grid">
        <div class="lab-panel">
          <div class="cache-panel-heading"><div><span class="cache-kicker">1 · Source-level view</span><strong data-cache-loop-title></strong></div><span data-cache-step-label></span></div>
          <pre class="cache-code" data-cache-code></pre>
          <div class="cache-matrix" data-cache-matrix aria-label="4 by 4 row-major matrix"></div>
          <input class="cache-timeline" data-cache-timeline type="range" min="0" max="15" value="0" aria-label="Cache access timeline" />
        </div>

        <div class="lab-panel cache-xray">
          <span class="cache-kicker">2 · What the machine sees</span>
          <div class="cache-causal-chain" aria-live="polite">
            <div><span>Cell</span><strong data-cache-cell></strong></div>
            <b>→</b><div><span>Address</span><strong data-cache-address></strong></div>
            <b>→</b><div><span>Block</span><strong data-cache-memory-block></strong></div>
            <b>→</b><div><span>Cache line</span><strong data-cache-line-index></strong></div>
          </div>
          <div class="cache-event" data-cache-event></div>
          <div class="cache-lines" data-cache-state></div>
        </div>
      </section>

      <section class="lab-panel cache-predict">
        <div>
          <span class="cache-kicker">Predict before reveal</span>
          <strong>Will the next access be a cache hit or miss?</strong>
          <p class="lab-note" data-cache-predict-prompt></p>
        </div>
        <div class="cache-predict-actions">
          <button type="button" data-cache-predict="hit">Hit</button>
          <button type="button" data-cache-predict="miss">Miss</button>
        </div>
        <p class="cache-feedback" data-cache-feedback aria-live="polite"></p>
      </section>

      <section class="lab-panel">
        <div class="cache-panel-heading"><div><span class="cache-kicker">Side-by-side comparison</span><strong>Same 4×4 matrix. Same 16 reads. Different locality.</strong></div></div>
        <div class="cache-compare" data-cache-compare></div>
        <p class="lab-note">The array is stored row by row. Row-major traversal consumes neighbors from a loaded cache block before moving on. Column-major traversal jumps by an entire row, which can repeatedly replace useful blocks when the cache is small.</p>
      </section>

      <section class="lab-panel cache-takeaway">
        <strong>Why this matters</strong>
        <p class="lab-note">Big-O can say both loops are O(n²), yet their real memory behavior can be very different. Cache locality is one reason two algorithms with the same asymptotic complexity can perform differently on real hardware.</p>
      </section>
    </div>`;

  const controller = new AbortController();
  const signal = controller.signal;
  const orderSelect = host.querySelector<HTMLSelectElement>("[data-cache-order]")!;
  const blockInput = host.querySelector<HTMLInputElement>("[data-cache-block]")!;
  const linesInput = host.querySelector<HTMLInputElement>("[data-cache-lines]")!;
  const timeline = host.querySelector<HTMLInputElement>("[data-cache-timeline]")!;
  const playButton = host.querySelector<HTMLButtonElement>("[data-cache-play]")!;
  let step = 0;
  let timer: number | null = null;
  let prediction: "hit" | "miss" | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playButton.textContent = "Play";
  };

  const currentSimulation = (): CacheSimulation => simulateCache(
    4,
    4,
    orderSelect.value as TraversalOrder,
    Number(blockInput.value),
    Number(linesInput.value)
  );

  const renderMatrix = (simulation: CacheSimulation) => {
    const matrix = host.querySelector<HTMLElement>("[data-cache-matrix]")!;
    matrix.replaceChildren();
    const access = simulation.accesses[step];
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const address = row * 4 + column;
        const cell = document.createElement("div");
        cell.className = "cache-cell";
        if (row === access.row && column === access.column) cell.classList.add("is-current");
        if (simulation.accesses.slice(0, step).some(item => item.row === row && item.column === column)) cell.classList.add("is-visited");
        const coord = document.createElement("span");
        coord.textContent = `[${row}][${column}]`;
        const addr = document.createElement("small");
        addr.textContent = `addr ${address}`;
        cell.append(coord, addr);
        matrix.append(cell);
      }
    }
  };

  const renderCacheState = (simulation: CacheSimulation) => {
    const state = host.querySelector<HTMLElement>("[data-cache-state]")!;
    const access = simulation.accesses[step];
    state.replaceChildren();
    access.cache.forEach(line => {
      const row = document.createElement("div");
      row.className = "cache-line-row";
      if (line.line === access.cacheLine) row.classList.add("is-active");
      const index = document.createElement("strong");
      index.textContent = `Line ${line.line}`;
      const mapping = document.createElement("span");
      mapping.textContent = line.block === null ? "empty" : `memory block ${line.block}`;
      row.append(index, mapping);
      state.append(row);
    });
  };

  const renderComparison = () => {
    const comparisonHost = host.querySelector<HTMLElement>("[data-cache-compare]")!;
    const comparison = compareTraversal(4, 4, Number(blockInput.value), Number(linesInput.value));
    comparisonHost.replaceChildren();
    ([comparison.rowMajor, comparison.columnMajor] as CacheSimulation[]).forEach(run => {
      const card = document.createElement("div");
      card.className = "cache-compare-card";
      const title = document.createElement("strong");
      title.textContent = run.order === "row-major" ? "Row-major" : "Column-major";
      const rate = document.createElement("b");
      rate.textContent = `${formatPercent(run.hitRate)} hit rate`;
      const detail = document.createElement("span");
      detail.textContent = `${run.hits} hits · ${run.misses} misses`;
      const meter = document.createElement("div");
      meter.className = "cache-meter";
      const fill = document.createElement("i");
      fill.style.width = `${run.hitRate * 100}%`;
      meter.append(fill);
      card.append(title, rate, detail, meter);
      comparisonHost.append(card);
    });
  };

  const draw = () => {
    const simulation = currentSimulation();
    step = Math.min(step, simulation.accesses.length - 1);
    const access = simulation.accesses[step];
    timeline.max = String(simulation.accesses.length - 1);
    timeline.value = String(step);
    host.querySelector<HTMLElement>("[data-cache-block-value]")!.textContent = String(simulation.elementsPerLine);
    host.querySelector<HTMLElement>("[data-cache-lines-value]")!.textContent = String(simulation.cacheLineCount);
    host.querySelector<HTMLElement>("[data-cache-step-label]")!.textContent = `Access ${step + 1} / ${simulation.accesses.length}`;
    host.querySelector<HTMLElement>("[data-cache-loop-title]")!.textContent = simulation.order === "row-major" ? "Rows on the outside" : "Columns on the outside";
    host.querySelector<HTMLElement>("[data-cache-code]")!.textContent = simulation.order === "row-major"
      ? "for (row = 0; row < 4; ++row)\n  for (col = 0; col < 4; ++col)\n    use(matrix[row][col]);"
      : "for (col = 0; col < 4; ++col)\n  for (row = 0; row < 4; ++row)\n    use(matrix[row][col]);";
    host.querySelector<HTMLElement>("[data-cache-cell]")!.textContent = `[${access.row}][${access.column}]`;
    host.querySelector<HTMLElement>("[data-cache-address]")!.textContent = String(access.address);
    host.querySelector<HTMLElement>("[data-cache-memory-block]")!.textContent = String(access.block);
    host.querySelector<HTMLElement>("[data-cache-line-index]")!.textContent = String(access.cacheLine);
    const event = host.querySelector<HTMLElement>("[data-cache-event]")!;
    event.className = `cache-event ${access.hit ? "is-hit" : "is-miss"}`;
    event.textContent = access.hit
      ? `HIT · block ${access.block} is already in cache line ${access.cacheLine}.`
      : access.evictedBlock === null
        ? `MISS · load block ${access.block} into empty cache line ${access.cacheLine}.`
        : `MISS · block ${access.block} replaces block ${access.evictedBlock} in cache line ${access.cacheLine}.`;
    const next = simulation.accesses[step + 1];
    host.querySelector<HTMLElement>("[data-cache-predict-prompt]")!.textContent = next
      ? `Next: matrix[${next.row}][${next.column}] → address ${next.address}. Predict before stepping.`
      : "You reached the end. Scrub backward to make another prediction.";
    host.querySelectorAll<HTMLButtonElement>("[data-cache-predict]").forEach(button => { button.disabled = !next; });
    renderMatrix(simulation);
    renderCacheState(simulation);
    renderComparison();
  };

  const resetPrediction = () => {
    prediction = null;
    host.querySelector<HTMLElement>("[data-cache-feedback]")!.textContent = "";
    host.querySelectorAll<HTMLButtonElement>("[data-cache-predict]").forEach(button => button.setAttribute("aria-pressed", "false"));
  };

  const moveTo = (nextStep: number) => {
    const simulation = currentSimulation();
    step = Math.max(0, Math.min(simulation.accesses.length - 1, nextStep));
    resetPrediction();
    draw();
  };

  orderSelect.addEventListener("change", () => { stop(); step = 0; resetPrediction(); draw(); }, { signal });
  blockInput.addEventListener("input", () => { stop(); step = 0; resetPrediction(); draw(); }, { signal });
  linesInput.addEventListener("input", () => { stop(); step = 0; resetPrediction(); draw(); }, { signal });
  timeline.addEventListener("input", () => { stop(); moveTo(Number(timeline.value)); }, { signal });
  host.querySelector<HTMLButtonElement>("[data-cache-prev]")!.addEventListener("click", () => { stop(); moveTo(step - 1); }, { signal });
  host.querySelector<HTMLButtonElement>("[data-cache-next]")!.addEventListener("click", () => { stop(); moveTo(step + 1); }, { signal });
  playButton.addEventListener("click", () => {
    if (timer !== null) { stop(); return; }
    playButton.textContent = "Pause";
    timer = window.setInterval(() => {
      const last = currentSimulation().accesses.length - 1;
      if (step >= last) { stop(); return; }
      moveTo(step + 1);
    }, 650);
  }, { signal });
  host.querySelectorAll<HTMLButtonElement>("[data-cache-predict]").forEach(button => button.addEventListener("click", () => {
    const simulation = currentSimulation();
    const next = simulation.accesses[step + 1];
    if (!next) return;
    prediction = button.dataset.cachePredict as "hit" | "miss";
    host.querySelectorAll<HTMLButtonElement>("[data-cache-predict]").forEach(candidate => candidate.setAttribute("aria-pressed", String(candidate === button)));
    host.querySelector<HTMLElement>("[data-cache-feedback]")!.textContent = prediction === (next.hit ? "hit" : "miss")
      ? `Correct. Address ${next.address} maps to block ${next.block}; cache line ${next.cacheLine} ${next.hit ? "already contains it" : "does not contain it"}.`
      : `Not this time. Follow address ${next.address} → block ${next.block} → cache line ${next.cacheLine}; it will be a ${next.hit ? "hit" : "miss"}.`;
  }, { signal }));

  draw();
  return () => { stop(); controller.abort(); };
}

registerLabModule({
  id: "cache-locality",
  icon: "🧊",
  title: "Cache Locality X-Ray",
  description: "See addresses become cache blocks, predict hits and misses, and compare row-major vs column-major memory access.",
  featured: true,
  render: renderCacheLocalityLab
});
