import "./pageReplacementLab.css";
import { registerLabModule } from "./moduleRegistry";
import { comparePagePolicies, detectBeladyAnomaly, parseReferences, simulatePageReplacement, type PagePolicy, type PageResult } from "./pageReplacementModel";

const policyNames: Record<PagePolicy, string> = { fifo: "FIFO", lru: "LRU", optimal: "Optimal" };
const playbackDelays: Record<string, number> = { "0.5": 1050, "1": 650, "2": 325, "4": 165 };

const presets = {
  locality: [1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3],
  thrashing: [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
  belady: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]
};

registerLabModule({
  id: "page-replacement",
  icon: "VM",
  title: "Virtual Memory: Page Replacement",
  description: "Predict hits and faults, scrub FIFO/LRU/Optimal traces, compare policies, and reproduce Belady's anomaly.",
  featured: true,
  render(host) {
    host.innerHTML = `<div class="page-replacement-lab">
      <div class="page-controls">
        <label>Policy<select data-page-policy><option value="fifo">FIFO</option><option value="lru">LRU</option><option value="optimal">Optimal</option></select></label>
        <label>Frames<input data-page-frames type="number" min="1" max="8" value="3"></label>
        <label>Reference string<input class="page-reference-input" data-page-refs value="7,0,1,2,0,3,0,4,2,3,0,3,2" aria-label="Page reference string"></label>
        <button type="button" data-page-build>Build Trace</button>
        <button type="button" data-page-prev>Previous</button>
        <button type="button" data-page-play>Play</button>
        <button type="button" data-page-next>Next</button>
        <label>Speed<select data-page-speed><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label>
      </div>
      <div class="page-presets">
        <strong>Try a scenario:</strong>
        <button type="button" data-page-locality>Locality</button>
        <button type="button" data-page-thrashing>Thrashing</button>
        <button type="button" data-page-belady>Belady's Anomaly</button>
        <button type="button" data-page-compare>Compare Policies</button>
      </div>
      <label class="page-timeline-label"><span>Reference timeline</span><input data-page-timeline class="page-timeline" type="range" min="0" value="0"></label>
      <div class="page-metrics" data-page-metrics aria-live="polite"></div>
      <div class="page-layout">
        <section class="page-panel">
          <strong>Reference trace</strong>
          <p class="page-help">Green means hit; orange means fault. Click any page to jump to that reference.</p>
          <div class="page-step-strip" data-page-steps></div>
          <div class="page-explain" data-page-explain aria-live="polite"></div>
        </section>
        <section class="page-panel">
          <strong>Physical frames</strong>
          <p class="page-help">These are the pages resident in memory after the current reference.</p>
          <div class="page-frames" data-page-frame-view></div>
        </section>
      </div>
      <section class="page-panel page-predict-panel">
        <strong>Predict the next memory access</strong>
        <p class="page-help">Before pressing Next, decide whether the next referenced page is already resident.</p>
        <div class="page-predict-buttons"><button type="button" data-page-predict="hit">HIT</button><button type="button" data-page-predict="fault">FAULT</button></div>
        <p data-page-prediction class="page-prediction" role="status" aria-live="polite">Make a prediction, then advance one step.</p>
      </section>
      <section class="page-panel"><strong>Policy comparison</strong><div class="page-policy-cards" data-page-comparison></div><div class="page-anomaly" data-page-anomaly></div></section>
    </div>`;

    const policySelect = host.querySelector<HTMLSelectElement>("[data-page-policy]")!;
    const frameInput = host.querySelector<HTMLInputElement>("[data-page-frames]")!;
    const refsInput = host.querySelector<HTMLInputElement>("[data-page-refs]")!;
    const speedSelect = host.querySelector<HTMLSelectElement>("[data-page-speed]")!;
    const timeline = host.querySelector<HTMLInputElement>("[data-page-timeline]")!;
    const metrics = host.querySelector<HTMLElement>("[data-page-metrics]")!;
    const steps = host.querySelector<HTMLElement>("[data-page-steps]")!;
    const frameView = host.querySelector<HTMLElement>("[data-page-frame-view]")!;
    const explain = host.querySelector<HTMLElement>("[data-page-explain]")!;
    const comparison = host.querySelector<HTMLElement>("[data-page-comparison]")!;
    const anomaly = host.querySelector<HTMLElement>("[data-page-anomaly]")!;
    const prediction = host.querySelector<HTMLElement>("[data-page-prediction]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-page-play]")!;
    let result: PageResult = simulatePageReplacement(parseReferences(refsInput.value), "fifo", 3);
    let index = -1;
    let timer: number | null = null;

    const stop = (): void => { if (timer !== null) window.clearInterval(timer); timer = null; playButton.textContent = "Play"; };
    const pct = (value: number): string => `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const clearPrediction = (): void => {
      prediction.classList.remove("correct", "incorrect");
      prediction.textContent = index < result.steps.length - 1
        ? "Make a prediction, then advance one step."
        : "Trace complete. Move backward to predict an earlier reference.";
    };

    function renderMetrics(currentIndex: number): void {
      const shownSteps = currentIndex < 0 ? [] : result.steps.slice(0, currentIndex + 1);
      const faults = shownSteps.filter(step => !step.hit).length;
      const hits = shownSteps.filter(step => step.hit).length;
      const rate = shownSteps.length ? hits / shownSteps.length : 0;
      metrics.replaceChildren();
      const labels = [
        policyNames[result.policy],
        `Observed faults: ${faults}`,
        `Observed hits: ${hits}`,
        `Observed hit rate: ${pct(rate)}`,
        `Full-trace faults: ${result.faults}`
      ];
      labels.forEach((text, chipIndex) => {
        const chip = document.createElement("span");
        chip.className = `page-chip${chipIndex === 2 ? " good" : ""}`;
        chip.textContent = text;
        metrics.append(chip);
      });
    }

    function render(): void {
      const current = index >= 0 ? result.steps[index] : null;
      const displayed = current?.frames ?? Array(result.frameCount).fill(null);
      timeline.max = String(Math.max(0, result.steps.length));
      timeline.value = String(index + 1);
      renderMetrics(index);

      steps.replaceChildren();
      result.steps.forEach((step, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `page-step-dot ${step.hit ? "hit" : "fault"}${i === index ? " current" : ""}`;
        button.dataset.pageStep = String(i);
        button.setAttribute("aria-label", `Reference ${i + 1}: page ${step.page}, ${step.hit ? "hit" : "fault"}`);
        button.textContent = String(step.page);
        button.addEventListener("click", () => { stop(); index = i; clearPrediction(); render(); });
        steps.append(button);
      });

      frameView.replaceChildren();
      displayed.forEach((page, i) => {
        const frame = document.createElement("div");
        frame.className = "page-frame";
        const label = document.createElement("small");
        label.textContent = `Frame ${i + 1}`;
        const value = document.createElement("strong");
        value.textContent = page === null ? "—" : String(page);
        frame.append(label, value);
        frameView.append(frame);
      });

      explain.textContent = current?.explanation ?? "A page fault occurs when the referenced page is not resident in physical memory. Predict the first access, then step through the trace.";
      steps.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function build(): void {
      stop();
      result = simulatePageReplacement(parseReferences(refsInput.value), policySelect.value as PagePolicy, Number(frameInput.value));
      frameInput.value = String(result.frameCount);
      index = -1;
      comparison.replaceChildren();
      anomaly.replaceChildren();
      clearPrediction();
      render();
    }

    function loadPreset(values: number[], frames = 3, policy: PagePolicy = policySelect.value as PagePolicy): void {
      refsInput.value = values.join(",");
      frameInput.value = String(frames);
      policySelect.value = policy;
      build();
    }

    const startPlayback = (): void => {
      stop();
      if (!result.steps.length) return;
      if (index >= result.steps.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(() => {
        if (index >= result.steps.length - 1) return stop();
        index += 1;
        clearPrediction();
        render();
      }, playbackDelays[speedSelect.value] ?? playbackDelays["1"]);
    };

    host.querySelector("[data-page-build]")!.addEventListener("click", build);
    host.querySelector("[data-page-prev]")!.addEventListener("click", () => { stop(); index = Math.max(-1, index - 1); clearPrediction(); render(); });
    host.querySelector("[data-page-next]")!.addEventListener("click", () => { stop(); index = Math.min(result.steps.length - 1, index + 1); clearPrediction(); render(); });
    playButton.addEventListener("click", () => { if (timer !== null) return stop(); startPlayback(); });
    speedSelect.addEventListener("change", () => { if (timer !== null) startPlayback(); });
    timeline.addEventListener("input", () => {
      stop();
      index = Math.max(-1, Math.min(result.steps.length - 1, Number(timeline.value) - 1));
      clearPrediction();
      render();
    });
    policySelect.addEventListener("change", build);
    frameInput.addEventListener("change", build);

    host.querySelector("[data-page-locality]")!.addEventListener("click", () => {
      loadPreset(presets.locality, 3, "lru");
      explain.textContent = "Locality demo loaded: a small working set repeats often. Watch LRU preserve recently useful pages and build a high hit rate.";
    });
    host.querySelector("[data-page-thrashing]")!.addEventListener("click", () => {
      loadPreset(presets.thrashing, 3, "fifo");
      explain.textContent = "Thrashing demo loaded: the working set is larger than physical memory, so pages are repeatedly evicted before they can be reused.";
    });

    host.querySelector("[data-page-compare]")!.addEventListener("click", () => {
      stop();
      const results = comparePagePolicies(parseReferences(refsInput.value), Number(frameInput.value));
      const best = Math.min(...results.map(item => item.faults));
      comparison.replaceChildren();
      results.forEach(item => {
        const card = document.createElement("div");
        card.className = `page-policy-card${item.faults === best ? " best" : ""}`;
        const title = document.createElement("strong");
        title.textContent = `${policyNames[item.policy]}${item.faults === best ? " ★" : ""}`;
        [
          `Faults: ${item.faults}`,
          `Hits: ${item.hits}`,
          `Hit rate: ${pct(item.hitRate)}`
        ].forEach(text => {
          const span = document.createElement("span");
          span.textContent = text;
          card.append(span);
        });
        card.prepend(title);
        comparison.append(card);
      });
      explain.textContent = "Optimal is a theoretical benchmark because it requires future knowledge. LRU approximates locality using recent history; FIFO is simple but can behave counterintuitively.";
    });

    host.querySelector("[data-page-belady]")!.addEventListener("click", () => {
      stop();
      loadPreset(presets.belady, 3, "fifo");
      const demo = detectBeladyAnomaly(presets.belady, 3, 4);
      anomaly.replaceChildren();
      const title = document.createElement("strong");
      title.textContent = `Belady's anomaly ${demo.anomaly ? "reproduced" : "not observed"}`;
      const text = document.createElement("span");
      text.textContent = `FIFO with 3 frames has ${demo.lower.faults} faults, while 4 frames has ${demo.upper.faults}. More memory causing more faults shows why FIFO is not a stack algorithm.`;
      anomaly.append(title, text);
    });

    host.querySelectorAll<HTMLButtonElement>("[data-page-predict]").forEach(button => {
      button.addEventListener("click", () => {
        stop();
        if (index >= result.steps.length - 1) return clearPrediction();
        const actualHit = result.steps[index + 1].hit;
        const guessedHit = button.dataset.pagePredict === "hit";
        const correct = actualHit === guessedHit;
        prediction.classList.toggle("correct", correct);
        prediction.classList.toggle("incorrect", !correct);
        prediction.textContent = correct
          ? `Correct — page ${result.steps[index + 1].page} will be a ${actualHit ? "HIT" : "FAULT"}. Advance one step to confirm.`
          : `Not quite — page ${result.steps[index + 1].page} will be a ${actualHit ? "HIT" : "FAULT"}. Advance one step and inspect the resident frames.`;
      });
    });

    clearPrediction();
    render();
    return stop;
  }
});
