import "./algorithmMathLab.css";
import { registerLabModule } from "./moduleRegistry";
import { GROWTH_FUNCTIONS, growthValue, hardwareEquivalentInput, harmonicIntegralApprox, harmonicSum, optimizeSplitParameter, type GrowthId } from "./algorithmMathModel";

function compact(value: number): string {
  if (!Number.isFinite(value)) return "∞";
  if (value >= 1e12) return value.toExponential(2);
  if (value >= 1000) return Math.round(value).toLocaleString();
  return value.toFixed(value < 10 ? 2 : 0).replace(/\.00$/, "");
}

function renderAlgorithmMath(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module algorithm-math-lab">
      <section class="am-hero lab-panel">
        <div><span class="am-kicker">Math behind algorithms</span><h3>Why growth rate beats raw speed.</h3><p class="lab-note">Big-O is about how work grows as the input grows. Compare the classic complexity families, then use calculus to see where derivatives and integrals actually enter algorithm analysis.</p></div>
        <div class="am-formula">1 → log n → n → n log n → n² → 2ⁿ → n!</div>
      </section>

      <section class="lab-panel">
        <div class="am-section-heading"><div><span class="am-kicker">Growth race</span><strong>Same input, radically different work</strong></div><label>Input n <input data-am-n type="range" min="2" max="100" value="20"><span data-am-n-label>20</span></label></div>
        <div class="am-growth-chart" data-am-chart aria-label="Algorithm growth comparison"></div>
        <div class="am-growth-table" data-am-table></div>
        <p class="lab-note">Bars use a logarithmic visual scale so exponential and factorial growth do not flatten everything else. The displayed work estimates are the actual function values.</p>
      </section>

      <section class="am-grid">
        <div class="lab-panel">
          <span class="am-kicker">Hardware experiment</span><h4>What if the computer is 100× faster?</h4>
          <p class="lab-note">Choose a complexity. We give it 100× the work budget and ask how much larger an input it can handle.</p>
          <label>Complexity<select data-am-hardware></select></label>
          <div class="am-hardware-result"><span>At n = 20</span><strong data-am-hardware-result></strong></div>
          <p class="lab-note" data-am-hardware-note></p>
        </div>
        <div class="lab-panel">
          <span class="am-kicker">Predict</span><h4>100× faster hardware + O(2ⁿ)</h4>
          <p class="lab-note">Starting at n=20, which input is roughly possible with the larger work budget?</p>
          <div class="am-predict" data-am-predict><button type="button" data-answer="2000">n = 2,000</button><button type="button" data-answer="200">n = 200</button><button type="button" data-answer="26">n ≈ 26</button></div>
          <p class="lab-note" data-am-feedback>Make a prediction before revealing the result.</p>
        </div>
      </section>

      <section class="am-calculus-grid">
        <div class="lab-panel">
          <span class="am-kicker">Derivative → optimization</span><h4>Minimize T(k) = n/k + k</h4>
          <p class="lab-note">Differentiate: T′(k) = −n/k² + 1. The minimum occurs where the slope is zero, giving k = √n.</p>
          <label>n <input data-am-opt-n type="range" min="4" max="400" value="100"><span data-am-opt-label>100</span></label>
          <div class="am-opt-visual"><div class="am-opt-line"><span data-am-opt-marker></span></div><strong data-am-opt-result></strong></div>
          <p class="lab-note" data-am-opt-note></p>
        </div>
        <div class="lab-panel">
          <span class="am-kicker">Integral → approximation</span><h4>Σ 1/k grows like log n</h4>
          <p class="lab-note">A discrete sum can be compared with the area under 1/x. This is one reason integrals are useful when analyzing algorithms.</p>
          <label>Terms n <input data-am-sum-n type="range" min="2" max="1000" value="100"><span data-am-sum-label>100</span></label>
          <div class="am-sum-bars"><div><span>Exact Σ 1/k</span><strong data-am-sum-exact></strong></div><div><span>1 + ∫₁ⁿ 1/x dx</span><strong data-am-sum-integral></strong></div></div>
          <p class="lab-note" data-am-sum-note></p>
        </div>
      </section>

      <section class="lab-panel am-takeaway"><strong>The key idea</strong><p class="lab-note">Calculus is a useful tool, but most algorithm courses lean more heavily on discrete math. Use derivatives when a continuous parameter needs optimizing and integrals when a sum is easier to understand as continuous area. Big-O then keeps the growth-rate story front and center.</p></section>
    </div>`;

  const nInput = host.querySelector<HTMLInputElement>("[data-am-n]")!;
  const nLabel = host.querySelector<HTMLElement>("[data-am-n-label]")!;
  const chart = host.querySelector<HTMLElement>("[data-am-chart]")!;
  const table = host.querySelector<HTMLElement>("[data-am-table]")!;
  const hardware = host.querySelector<HTMLSelectElement>("[data-am-hardware]")!;
  const hardwareResult = host.querySelector<HTMLElement>("[data-am-hardware-result]")!;
  const hardwareNote = host.querySelector<HTMLElement>("[data-am-hardware-note]")!;
  const feedback = host.querySelector<HTMLElement>("[data-am-feedback]")!;
  const optN = host.querySelector<HTMLInputElement>("[data-am-opt-n]")!;
  const optLabel = host.querySelector<HTMLElement>("[data-am-opt-label]")!;
  const optMarker = host.querySelector<HTMLElement>("[data-am-opt-marker]")!;
  const optResult = host.querySelector<HTMLElement>("[data-am-opt-result]")!;
  const optNote = host.querySelector<HTMLElement>("[data-am-opt-note]")!;
  const sumN = host.querySelector<HTMLInputElement>("[data-am-sum-n]")!;
  const sumLabel = host.querySelector<HTMLElement>("[data-am-sum-label]")!;
  const sumExact = host.querySelector<HTMLElement>("[data-am-sum-exact]")!;
  const sumIntegral = host.querySelector<HTMLElement>("[data-am-sum-integral]")!;
  const sumNote = host.querySelector<HTMLElement>("[data-am-sum-note]")!;

  for (const growth of GROWTH_FUNCTIONS) {
    if (growth.id === "constant") continue;
    const option = document.createElement("option");
    option.value = growth.id;
    option.textContent = `${growth.notation} · ${growth.label}`;
    hardware.append(option);
  }
  hardware.value = "exponential";

  const drawGrowth = () => {
    const n = Number(nInput.value);
    nLabel.textContent = String(n);
    chart.replaceChildren();
    table.replaceChildren();
    const values = GROWTH_FUNCTIONS.map(growth => ({ growth, value: growthValue(growth.id, n) }));
    const logs = values.map(item => Math.log10(Math.max(1, item.value))).filter(Number.isFinite);
    const maxLog = Math.max(1, ...logs);
    for (const item of values) {
      const column = document.createElement("div");
      column.className = "am-growth-column";
      const bar = document.createElement("div");
      bar.className = "am-growth-bar";
      const log = Number.isFinite(item.value) ? Math.log10(Math.max(1, item.value)) : maxLog;
      bar.style.height = `${Math.max(5, (log / maxLog) * 100)}%`;
      const notation = document.createElement("strong");
      notation.textContent = item.growth.notation;
      column.append(bar, notation);
      chart.append(column);

      const row = document.createElement("div");
      const name = document.createElement("span");
      name.textContent = `${item.growth.notation} ${item.growth.label}`;
      const value = document.createElement("strong");
      value.textContent = compact(item.value);
      row.append(name, value);
      table.append(row);
    }
  };

  const drawHardware = () => {
    const id = hardware.value as GrowthId;
    const equivalent = hardwareEquivalentInput(id, 20, 100);
    hardwareResult.textContent = `100× faster → n ≈ ${equivalent.toLocaleString()}`;
    hardwareNote.textContent = id === "linear"
      ? "Linear work scales with the hardware budget, so 100× more work can handle about 100× more input."
      : id === "exponential"
        ? "Exponential growth consumes the entire hardware gain after only a few extra input units. A better algorithm can matter far more than a faster machine."
        : "The input gain depends on the growth class—not just the hardware multiplier.";
  };

  const drawOptimization = () => {
    const result = optimizeSplitParameter(Number(optN.value));
    optLabel.textContent = String(result.n);
    optMarker.style.left = `${Math.min(100, (result.optimum / Math.sqrt(400)) * 100)}%`;
    optResult.textContent = `k ≈ ${result.optimum.toFixed(2)}`;
    optNote.textContent = `At k = √${result.n}, T′(k) ≈ ${result.derivativeAtOptimum.toFixed(3)} and the modeled cost is ${result.cost.toFixed(2)}.`;
  };

  const drawIntegral = () => {
    const n = Number(sumN.value);
    const exact = harmonicSum(n);
    const approximate = harmonicIntegralApprox(n);
    sumLabel.textContent = String(n);
    sumExact.textContent = exact.toFixed(4);
    sumIntegral.textContent = approximate.toFixed(4);
    sumNote.textContent = `Difference: ${Math.abs(exact - approximate).toFixed(4)}. Both grow slowly—on the order of log n.`;
  };

  const onGrowth = () => drawGrowth();
  const onHardware = () => drawHardware();
  const onOpt = () => drawOptimization();
  const onSum = () => drawIntegral();
  nInput.addEventListener("input", onGrowth);
  hardware.addEventListener("change", onHardware);
  optN.addEventListener("input", onOpt);
  sumN.addEventListener("input", onSum);
  host.querySelectorAll<HTMLButtonElement>("[data-answer]").forEach(button => button.addEventListener("click", () => {
    const correct = button.dataset.answer === "26";
    feedback.textContent = correct ? "Correct. 2²⁰ × 100 is only enough to reach roughly 2²⁶." : "That would require vastly more than a 100× speedup. Try comparing powers of two.";
  }));

  drawGrowth(); drawHardware(); drawOptimization(); drawIntegral();
  return () => {
    nInput.removeEventListener("input", onGrowth);
    hardware.removeEventListener("change", onHardware);
    optN.removeEventListener("input", onOpt);
    sumN.removeEventListener("input", onSum);
  };
}

registerLabModule({
  id: "algorithm-math",
  icon: "📈",
  title: "Math Behind Algorithms",
  description: "Race Big-O growth curves, test faster hardware, and see how derivatives and integrals help analyze and optimize algorithms.",
  featured: true,
  render: renderAlgorithmMath
});
