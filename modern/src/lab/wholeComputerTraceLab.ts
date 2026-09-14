import "./wholeComputerTraceLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import { buildWholeComputerTrace, WHOLE_COMPUTER_MAX_INDEX, type WholeComputerLayer } from "./wholeComputerTraceModel";

type TranslationPrediction = "tlb-hit" | "page-table";
type CachePrediction = "hit" | "miss";

const layerLabel = (layer: WholeComputerLayer): string => ({
  source: "source",
  compiler: "compiler",
  cpu: "cpu",
  "virtual-memory": "virtual memory",
  cache: "cache"
})[layer];

function renderWholeComputerTrace(host: HTMLElement): LabModuleCleanup {
  host.innerHTML = `
    <div class="lab-module whole-trace-lab">
      <section class="lab-panel whole-trace-hero">
        <div>
          <span class="whole-trace-kicker">X-Ray Trace Session · one operation, no context reset</span>
          <h3>Follow one C++ load through the whole computer</h3>
          <p class="lab-note">Keep the identity of <code>total += values[i]</code> while it changes representation: source → tokens → AST → IR → assembly → registers → virtual address → TLB/page table → physical address → cache → CPU value.</p>
        </div>
        <div class="whole-trace-identity" aria-label="Current trace identity">
          <span>Operation identity</span>
          <strong data-trace-identity></strong>
          <span data-trace-address></span>
        </div>
      </section>

      <section class="lab-panel whole-trace-controls">
        <label>Array index i
          <input data-trace-index type="range" min="0" max="${WHOLE_COMPUTER_MAX_INDEX}" step="1" value="3" aria-label="Array index for whole computer trace">
          <output data-trace-index-output>3</output>
        </label>
        <div class="whole-trace-playback">
          <button type="button" data-trace-prev>Previous</button>
          <button type="button" data-trace-play>Play</button>
          <button type="button" data-trace-next>Next</button>
        </div>
      </section>

      <section class="lab-panel">
        <span class="whole-trace-kicker">Persistent breadcrumb</span>
        <div class="whole-trace-track-wrap"><div class="whole-trace-track" data-trace-track aria-label="Whole computer trace stages"></div></div>
      </section>

      <section class="lab-panel whole-trace-stage" aria-live="polite">
        <div class="whole-trace-stage-heading"><strong data-trace-stage-title></strong><span data-trace-stage-count></span></div>
        <pre data-trace-stage-code></pre>
        <p class="lab-note" data-trace-stage-explanation></p>
        <label class="whole-trace-scrubber">Trace stage
          <input data-trace-stage type="range" min="0" max="13" step="1" value="0" aria-label="Whole computer trace stage">
        </label>
      </section>

      <section class="lab-panel whole-trace-predict">
        <div>
          <span class="whole-trace-kicker">Predict before reveal</span>
          <strong>What hidden state has the loop already built before this load?</strong>
          <p class="lab-note">The selected iteration is not simulated in isolation: earlier loop iterations execute first, so TLB and cache state can make later loads faster.</p>
        </div>
        <div class="whole-trace-predict-grid">
          <div class="whole-trace-predict-group">
            <strong>Translation path</strong>
            <div class="whole-trace-predict-actions" role="group" aria-label="Translation path prediction">
              <button type="button" data-trace-translation="tlb-hit">TLB hit</button>
              <button type="button" data-trace-translation="page-table">Page-table path</button>
            </div>
          </div>
          <div class="whole-trace-predict-group">
            <strong>Cache result</strong>
            <div class="whole-trace-predict-actions" role="group" aria-label="Cache result prediction">
              <button type="button" data-trace-cache="hit">Cache hit</button>
              <button type="button" data-trace-cache="miss">Cache miss</button>
            </div>
          </div>
        </div>
        <p class="whole-trace-feedback" data-trace-feedback aria-live="polite">Choose one translation prediction and one cache prediction to reveal the machine state.</p>
      </section>

      <section class="lab-panel whole-trace-state" data-trace-state aria-label="Revealed machine state">
        <div class="whole-trace-fact"><span>Virtual address</span><strong data-trace-va>hidden</strong></div>
        <div class="whole-trace-fact"><span>Translation</span><strong data-trace-translation-result>hidden</strong></div>
        <div class="whole-trace-fact"><span>Physical address</span><strong data-trace-pa>hidden</strong></div>
        <div class="whole-trace-fact"><span>Cache</span><strong data-trace-cache-result>hidden</strong></div>
      </section>

      <section class="lab-panel whole-trace-summary">
        <span class="whole-trace-kicker">Why this trace matters</span>
        <strong>One line of source code survives every representation change.</strong>
        <span class="whole-trace-summary-path" data-trace-summary></span>
        <p class="lab-note">This view deliberately combines concepts that are usually taught on separate pages. The operation stays the same even though each layer names and represents it differently.</p>
      </section>
    </div>`;

  const controller = new AbortController();
  const signal = controller.signal;
  const indexInput = host.querySelector<HTMLInputElement>("[data-trace-index]")!;
  const stageInput = host.querySelector<HTMLInputElement>("[data-trace-stage]")!;
  const playButton = host.querySelector<HTMLButtonElement>("[data-trace-play]")!;
  const track = host.querySelector<HTMLElement>("[data-trace-track]")!;
  let timer: number | null = null;
  let translationPrediction: TranslationPrediction | null = null;
  let cachePrediction: CachePrediction | null = null;

  const stop = (): void => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    playButton.textContent = "Play";
  };

  const resetPrediction = (): void => {
    translationPrediction = null;
    cachePrediction = null;
    host.querySelectorAll<HTMLButtonElement>("[data-trace-translation], [data-trace-cache]").forEach(button => button.setAttribute("aria-pressed", "false"));
    host.querySelector<HTMLElement>("[data-trace-feedback]")!.textContent = "Choose one translation prediction and one cache prediction to reveal the machine state.";
  };

  const drawPrediction = (): void => {
    const trace = buildWholeComputerTrace(Number(indexInput.value));
    const feedback = host.querySelector<HTMLElement>("[data-trace-feedback]")!;
    const revealed = translationPrediction !== null && cachePrediction !== null;

    host.querySelector<HTMLElement>("[data-trace-va]")!.textContent = revealed ? `0x${trace.effectiveAddress.toString(16).padStart(4, "0")}` : "hidden";
    host.querySelector<HTMLElement>("[data-trace-translation-result]")!.textContent = revealed
      ? trace.tlbHit ? "TLB hit" : trace.pageFault ? "page fault" : "TLB miss → page table"
      : "hidden";
    host.querySelector<HTMLElement>("[data-trace-pa]")!.textContent = revealed ? `0x${trace.physicalAddress.toString(16).padStart(4, "0")}` : "hidden";
    host.querySelector<HTMLElement>("[data-trace-cache-result]")!.textContent = revealed ? trace.cacheHit ? "cache hit" : "cache miss" : "hidden";

    if (!revealed) return;
    const expectedTranslation: TranslationPrediction = trace.tlbHit ? "tlb-hit" : "page-table";
    const expectedCache: CachePrediction = trace.cacheHit ? "hit" : "miss";
    const translationCorrect = translationPrediction === expectedTranslation;
    const cacheCorrect = cachePrediction === expectedCache;
    const correctness = translationCorrect && cacheCorrect
      ? "Both predictions are correct."
      : translationCorrect || cacheCorrect
        ? "One prediction is correct."
        : "Both predictions need another look.";
    const history = trace.index === 0
      ? "This is the first load, so the relevant TLB translation and cache block have not been warmed yet."
      : `Iterations 0 through ${trace.index - 1} ran first, leaving real TLB/cache state behind.`;
    feedback.textContent = `${correctness} Actual path: ${trace.tlbHit ? "TLB hit" : trace.pageFault ? "page fault" : "page-table lookup"}, then cache ${trace.cacheHit ? "hit" : "miss"}. ${history}`;
  };

  const draw = (): void => {
    const trace = buildWholeComputerTrace(Number(indexInput.value));
    const stageIndex = Math.min(trace.stages.length - 1, Math.max(0, Number(stageInput.value) || 0));
    const stage = trace.stages[stageIndex];
    indexInput.value = String(trace.index);
    stageInput.max = String(trace.stages.length - 1);
    stageInput.value = String(stageIndex);
    host.querySelector<HTMLOutputElement>("[data-trace-index-output]")!.value = String(trace.index);
    host.querySelector<HTMLElement>("[data-trace-identity]")!.textContent = `values[${trace.index}]`;
    host.querySelector<HTMLElement>("[data-trace-address]")!.textContent = `effective address 0x${trace.effectiveAddress.toString(16).padStart(4, "0")}`;
    host.querySelector<HTMLElement>("[data-trace-stage-title]")!.textContent = stage.title;
    host.querySelector<HTMLElement>("[data-trace-stage-count]")!.textContent = `${stageIndex + 1} / ${trace.stages.length} · ${layerLabel(stage.layer)}`;
    host.querySelector<HTMLElement>("[data-trace-stage-code]")!.textContent = stage.code;
    host.querySelector<HTMLElement>("[data-trace-stage-explanation]")!.textContent = stage.explanation;
    host.querySelector<HTMLElement>("[data-trace-summary]")!.textContent = `values[${trace.index}] → VA 0x${trace.effectiveAddress.toString(16)} → ${trace.tlbHit ? "TLB hit" : trace.pageFault ? "page fault" : "page table"} → PA 0x${trace.physicalAddress.toString(16)} → cache ${trace.cacheHit ? "hit" : "miss"} → CPU register`;

    track.replaceChildren();
    trace.stages.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "whole-trace-node";
      if (index <= stageIndex) button.classList.add("visited");
      button.setAttribute("aria-pressed", String(index === stageIndex));
      const layer = document.createElement("small");
      layer.textContent = layerLabel(item.layer);
      const label = document.createElement("span");
      label.textContent = item.title.replace(/^\d+ · /, "");
      button.append(layer, label);
      button.addEventListener("click", () => {
        stop();
        stageInput.value = String(index);
        draw();
      }, { once: true });
      track.append(button);
    });
    drawPrediction();
  };

  const move = (delta: number): void => {
    stop();
    const max = Number(stageInput.max) || 13;
    stageInput.value = String(Math.min(max, Math.max(0, Number(stageInput.value) + delta)));
    draw();
  };

  indexInput.addEventListener("input", () => {
    stop();
    resetPrediction();
    draw();
  }, { signal });
  stageInput.addEventListener("input", () => {
    stop();
    draw();
  }, { signal });
  host.querySelector<HTMLButtonElement>("[data-trace-prev]")!.addEventListener("click", () => move(-1), { signal });
  host.querySelector<HTMLButtonElement>("[data-trace-next]")!.addEventListener("click", () => move(1), { signal });
  playButton.addEventListener("click", () => {
    if (timer !== null) {
      stop();
      return;
    }
    const max = Number(stageInput.max) || 13;
    if (Number(stageInput.value) >= max) stageInput.value = "0";
    playButton.textContent = "Pause";
    draw();
    timer = window.setInterval(() => {
      const next = Number(stageInput.value) + 1;
      if (next > max) {
        stop();
        return;
      }
      stageInput.value = String(next);
      draw();
    }, 850);
  }, { signal });

  host.querySelectorAll<HTMLButtonElement>("[data-trace-translation]").forEach(button => {
    button.addEventListener("click", () => {
      translationPrediction = button.dataset.traceTranslation as TranslationPrediction;
      host.querySelectorAll<HTMLButtonElement>("[data-trace-translation]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      drawPrediction();
    }, { signal });
  });
  host.querySelectorAll<HTMLButtonElement>("[data-trace-cache]").forEach(button => {
    button.addEventListener("click", () => {
      cachePrediction = button.dataset.traceCache as CachePrediction;
      host.querySelectorAll<HTMLButtonElement>("[data-trace-cache]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      drawPrediction();
    }, { signal });
  });

  draw();
  return () => {
    stop();
    controller.abort();
  };
}

registerLabModule({
  id: "whole-computer-trace",
  icon: "X→CPU",
  title: "Whole Computer Trace",
  description: "Keep one C++ array load in context while it crosses compiler representations, CPU address generation, virtual memory, the TLB, page table, cache, and registers.",
  featured: true,
  render: renderWholeComputerTrace
});
