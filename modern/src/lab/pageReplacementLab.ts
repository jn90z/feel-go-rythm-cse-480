import "./pageReplacementLab.css";
import { registerLabModule } from "./moduleRegistry";
import { comparePagePolicies, detectBeladyAnomaly, parseReferences, simulatePageReplacement, type PagePolicy, type PageResult } from "./pageReplacementModel";

const policyNames: Record<PagePolicy, string> = { fifo: "FIFO", lru: "LRU", optimal: "Optimal" };

registerLabModule({
  id: "page-replacement",
  icon: "VM",
  title: "Virtual Memory: Page Replacement",
  description: "Step through FIFO, LRU, and Optimal page replacement, compare page-fault rates, and reproduce Belady's anomaly.",
  featured: true,
  render(host) {
    host.innerHTML = `<div class="page-replacement-lab">
      <div class="page-controls">
        <label>Policy<select data-page-policy><option value="fifo">FIFO</option><option value="lru">LRU</option><option value="optimal">Optimal</option></select></label>
        <label>Frames<input data-page-frames type="number" min="1" max="8" value="3"></label>
        <label>Reference string<input class="page-reference-input" data-page-refs value="7,0,1,2,0,3,0,4,2,3,0,3,2" aria-label="Page reference string"></label>
        <button type="button" data-page-build>Build Trace</button><button type="button" data-page-prev>Previous</button><button type="button" data-page-next>Next</button><button type="button" data-page-play>Play</button>
      </div>
      <div class="page-presets"><button type="button" data-page-compare>Compare Policies</button><button type="button" data-page-belady>Belady's Anomaly Demo</button></div>
      <div class="page-metrics" data-page-metrics aria-live="polite"></div>
      <div class="page-layout"><section class="page-panel"><strong>Reference trace</strong><div class="page-step-strip" data-page-steps></div><div class="page-explain" data-page-explain aria-live="polite"></div></section><section class="page-panel"><strong>Physical frames</strong><div class="page-frames" data-page-frame-view></div></section></div>
      <section class="page-panel"><strong>Policy comparison</strong><div class="page-policy-cards" data-page-comparison></div><div class="page-anomaly" data-page-anomaly></div></section>
    </div>`;

    const policySelect = host.querySelector<HTMLSelectElement>("[data-page-policy]")!;
    const frameInput = host.querySelector<HTMLInputElement>("[data-page-frames]")!;
    const refsInput = host.querySelector<HTMLInputElement>("[data-page-refs]")!;
    const metrics = host.querySelector<HTMLElement>("[data-page-metrics]")!;
    const steps = host.querySelector<HTMLElement>("[data-page-steps]")!;
    const frameView = host.querySelector<HTMLElement>("[data-page-frame-view]")!;
    const explain = host.querySelector<HTMLElement>("[data-page-explain]")!;
    const comparison = host.querySelector<HTMLElement>("[data-page-comparison]")!;
    const anomaly = host.querySelector<HTMLElement>("[data-page-anomaly]")!;
    const playButton = host.querySelector<HTMLButtonElement>("[data-page-play]")!;
    let result: PageResult = simulatePageReplacement(parseReferences(refsInput.value), "fifo", 3);
    let index = -1;
    let timer: number | null = null;

    const stop = (): void => { if (timer !== null) window.clearInterval(timer); timer = null; playButton.textContent = "Play"; };
    const pct = (value: number): string => `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;

    function render(): void {
      const current = index >= 0 ? result.steps[index] : null;
      const displayed = current?.frames ?? Array(result.frameCount).fill(null);
      metrics.innerHTML = `<span class="page-chip">${policyNames[result.policy]}</span><span class="page-chip">Faults: ${result.faults}</span><span class="page-chip good">Hits: ${result.hits}</span><span class="page-chip">Hit rate: ${pct(result.hitRate)}</span>`;
      steps.innerHTML = result.steps.map((step, i) => `<button type="button" class="page-step-dot ${step.hit ? "hit" : "fault"} ${i === index ? "current" : ""}" data-page-step="${i}" aria-label="Reference ${i + 1}: page ${step.page}, ${step.hit ? "hit" : "fault"}">${step.page}</button>`).join("");
      steps.querySelectorAll<HTMLButtonElement>("[data-page-step]").forEach(button => button.addEventListener("click", () => { stop(); index = Number(button.dataset.pageStep); render(); }));
      frameView.innerHTML = displayed.map((page, i) => `<div class="page-frame"><small>Frame ${i + 1}</small><strong>${page ?? "—"}</strong></div>`).join("");
      explain.textContent = current?.explanation ?? "A page fault occurs when the referenced page is not resident in physical memory. Step through the trace to see how each replacement policy chooses a victim.";
      steps.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function build(): void {
      stop();
      result = simulatePageReplacement(parseReferences(refsInput.value), policySelect.value as PagePolicy, Number(frameInput.value));
      frameInput.value = String(result.frameCount);
      index = -1;
      comparison.replaceChildren(); anomaly.replaceChildren(); render();
    }

    host.querySelector("[data-page-build]")!.addEventListener("click", build);
    host.querySelector("[data-page-prev]")!.addEventListener("click", () => { stop(); index = Math.max(-1, index - 1); render(); });
    host.querySelector("[data-page-next]")!.addEventListener("click", () => { stop(); index = Math.min(result.steps.length - 1, index + 1); render(); });
    playButton.addEventListener("click", () => {
      if (timer !== null) return stop();
      if (!result.steps.length) return;
      if (index >= result.steps.length - 1) index = -1;
      playButton.textContent = "Pause";
      timer = window.setInterval(() => { if (index >= result.steps.length - 1) return stop(); index += 1; render(); }, 650);
    });
    policySelect.addEventListener("change", build); frameInput.addEventListener("change", build);

    host.querySelector("[data-page-compare]")!.addEventListener("click", () => {
      stop();
      const results = comparePagePolicies(parseReferences(refsInput.value), Number(frameInput.value));
      const best = Math.min(...results.map(item => item.faults));
      comparison.innerHTML = results.map(item => `<div class="page-policy-card ${item.faults === best ? "best" : ""}"><strong>${policyNames[item.policy]}</strong><span>Faults: ${item.faults}</span><span>Hits: ${item.hits}</span><span>Hit rate: ${pct(item.hitRate)}</span></div>`).join("");
      explain.textContent = "Optimal is a theoretical benchmark because it requires future knowledge. LRU approximates locality using recent history; FIFO is simple but can behave counterintuitively.";
    });

    host.querySelector("[data-page-belady]")!.addEventListener("click", () => {
      stop();
      const refs = [1,2,3,4,1,2,5,1,2,3,4,5];
      refsInput.value = refs.join(","); policySelect.value = "fifo"; frameInput.value = "3"; build();
      const demo = detectBeladyAnomaly(refs, 3, 4);
      anomaly.innerHTML = `<strong>Belady's anomaly ${demo.anomaly ? "reproduced" : "not observed"}</strong>FIFO with 3 frames has ${demo.lower.faults} faults, while 4 frames has ${demo.upper.faults}. More memory causing more faults shows why FIFO is not a stack algorithm.`;
    });

    render();
    return stop;
  }
});
