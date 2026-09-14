import "./fastInverseSqrtLab.css";
import { registerLabModule } from "./moduleRegistry";
import { bits32, fastInverseSqrt, normalizeVector } from "./fastInverseSqrtModel";

function renderFastInverseSqrt(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module fisr-lab">
      <section class="fisr-hero lab-panel">
        <div><span class="fisr-kicker">Graphics math + numerical methods</span><h3>Why normalize a vector with 1/√x?</h3><p class="lab-note">A direction vector needs length 1. Instead of dividing each component by √(x²+y²), multiply each component by the reciprocal square root of the squared length.</p></div>
        <div class="fisr-formula">v̂ = v · 1/√(v·v)</div>
      </section>
      <div class="lab-controls fisr-controls"><label>X<input data-fisr-x type="range" min="-10" max="10" step="0.1" value="3"></label><label>Y<input data-fisr-y type="range" min="-10" max="10" step="0.1" value="4"></label><button type="button" data-fisr-preset>3-4-5 Vector</button></div>
      <section class="fisr-vector-grid">
        <div class="lab-panel"><span class="fisr-kicker">Vector playground</span><div class="fisr-plane" data-fisr-plane><svg viewBox="0 0 400 400" role="img" aria-label="Vector normalization visualization"><line x1="200" y1="20" x2="200" y2="380" class="fisr-axis"/><line x1="20" y1="200" x2="380" y2="200" class="fisr-axis"/><circle cx="200" cy="200" r="120" class="fisr-unit-circle"/><line data-fisr-original x1="200" y1="200" x2="260" y2="120" class="fisr-vector original"/><line data-fisr-exact x1="200" y1="200" x2="260" y2="120" class="fisr-vector exact"/><line data-fisr-approx x1="200" y1="200" x2="260" y2="120" class="fisr-vector approx"/><circle data-fisr-handle cx="260" cy="120" r="9" class="fisr-handle"/></svg></div><div class="fisr-legend"><span>Original</span><span>Exact unit vector</span><span>Fast approximation</span></div></div>
        <div class="lab-panel fisr-metrics"><span class="fisr-kicker">Watch the math</span><div><span>v</span><strong data-fisr-vector></strong></div><div><span>v·v = length²</span><strong data-fisr-l2></strong></div><div><span>|v|</span><strong data-fisr-length></strong></div><div><span>Exact 1/√(v·v)</span><strong data-fisr-exact-inv></strong></div><div><span>Fast estimate after 1 Newton step</span><strong data-fisr-fast-inv></strong></div><div><span>Normalized exact</span><strong data-fisr-exact-v></strong></div><div><span>Normalized fast</span><strong data-fisr-fast-v></strong></div><div><span>Length error</span><strong data-fisr-error></strong></div></div>
      </section>
      <section class="lab-panel"><span class="fisr-kicker">Step through the famous trick</span><div class="fisr-stage-tabs" data-fisr-tabs><button type="button" data-stage="0">1 · Length²</button><button type="button" data-stage="1">2 · Float bits</button><button type="button" data-stage="2">3 · Magic estimate</button><button type="button" data-stage="3">4 · Newton step</button><button type="button" data-stage="4">5 · Normalize</button></div><div class="fisr-stage" data-fisr-stage aria-live="polite"></div></section>
      <section class="lab-panel fisr-bits-panel"><span class="fisr-kicker">IEEE-754 bit view</span><div class="fisr-bit-row"><span>input float</span><code data-fisr-input-bits></code></div><div class="fisr-bit-row"><span>shift right 1</span><code data-fisr-shifted-bits></code></div><div class="fisr-bit-row"><span>0x5f3759df − shifted</span><code data-fisr-guess-bits></code></div><p class="lab-note">The bit trick gives a surprisingly good initial guess for x⁻¹ᐟ². Newton-Raphson then rapidly improves that guess. The Quake III source uses one refinement step in its famous implementation. citeturn314525search24</p></section>
      <section class="lab-panel fisr-takeaway"><strong>What to understand</strong><p class="lab-note">The “magic number” is not the whole algorithm. The important chain is: vector normalization needs reciprocal length → reciprocal length is an inverse square root → the float bit pattern can seed a cheap approximation → Newton’s method turns the rough estimate into a much better one. On modern CPUs, hardware instructions often make this historical optimization unnecessary, but it remains an excellent lesson in numerical computing.</p></section>
    </div>`;

  const xInput = host.querySelector<HTMLInputElement>("[data-fisr-x]")!;
  const yInput = host.querySelector<HTMLInputElement>("[data-fisr-y]")!;
  const original = host.querySelector<SVGLineElement>("[data-fisr-original]")!;
  const exactLine = host.querySelector<SVGLineElement>("[data-fisr-exact]")!;
  const approxLine = host.querySelector<SVGLineElement>("[data-fisr-approx]")!;
  const handle = host.querySelector<SVGCircleElement>("[data-fisr-handle]")!;
  const stageHost = host.querySelector<HTMLElement>("[data-fisr-stage]")!;
  const tabs = [...host.querySelectorAll<HTMLButtonElement>("[data-stage]")];
  let stage = 0;

  const setLine = (line: SVGLineElement, x: number, y: number, scale: number) => {
    line.setAttribute("x2", String(200 + x * scale));
    line.setAttribute("y2", String(200 - y * scale));
  };

  const draw = () => {
    const x = Number(xInput.value);
    const y = Number(yInput.value);
    const vector = normalizeVector(x, y);
    const inv = vector.lengthSquared > 0 ? fastInverseSqrt(vector.lengthSquared) : null;
    host.querySelector<HTMLElement>("[data-fisr-vector]")!.textContent = `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
    host.querySelector<HTMLElement>("[data-fisr-l2]")!.textContent = vector.lengthSquared.toFixed(4);
    host.querySelector<HTMLElement>("[data-fisr-length]")!.textContent = vector.length.toFixed(6);
    host.querySelector<HTMLElement>("[data-fisr-exact-inv]")!.textContent = vector.exactInverseLength.toFixed(8);
    host.querySelector<HTMLElement>("[data-fisr-fast-inv]")!.textContent = vector.approximateInverseLength.toFixed(8);
    host.querySelector<HTMLElement>("[data-fisr-exact-v]")!.textContent = `(${vector.exact.x.toFixed(5)}, ${vector.exact.y.toFixed(5)})`;
    host.querySelector<HTMLElement>("[data-fisr-fast-v]")!.textContent = `(${vector.approximate.x.toFixed(5)}, ${vector.approximate.y.toFixed(5)})`;
    host.querySelector<HTMLElement>("[data-fisr-error]")!.textContent = `${vector.lengthErrorPercent.toFixed(4)}%`;
    const originalScale = 12;
    setLine(original, vector.x, vector.y, originalScale);
    setLine(exactLine, vector.exact.x, vector.exact.y, 120);
    setLine(approxLine, vector.approximate.x, vector.approximate.y, 120);
    handle.setAttribute("cx", String(200 + vector.x * originalScale));
    handle.setAttribute("cy", String(200 - vector.y * originalScale));

    const inputBits = host.querySelector<HTMLElement>("[data-fisr-input-bits]")!;
    const shiftedBits = host.querySelector<HTMLElement>("[data-fisr-shifted-bits]")!;
    const guessBits = host.querySelector<HTMLElement>("[data-fisr-guess-bits]")!;
    inputBits.textContent = inv ? bits32(inv.inputBits) : "—";
    shiftedBits.textContent = inv ? bits32(inv.shiftedBits) : "—";
    guessBits.textContent = inv ? bits32(inv.guessBits) : "—";

    const stages = [
      `Start with v·v = ${vector.lengthSquared.toFixed(4)}. This avoids computing the square root until we actually need the reciprocal length.`,
      inv ? `Treat ${inv.input.toFixed(4)} as a 32-bit IEEE-754 float. Its exponent and mantissa encode the number approximately like scientific notation in base 2.` : "The zero vector has no direction, so normalization is undefined.",
      inv ? `The integer operation 0x5f3759df − (bits >> 1) produces an initial estimate ${inv.initialGuess.toFixed(8)} for 1/√x.` : "Choose a non-zero vector to see the approximation.",
      inv ? `One Newton step y ← y(1.5 − 0.5xy²) gives ${inv.afterOneNewton.toFixed(8)}. Error falls to ${inv.oneIterationErrorPercent.toFixed(5)}%. A second step reaches ${inv.afterTwoNewton.toFixed(8)}.` : "Newton refinement needs a positive squared length.",
      `Multiply the original vector by the inverse length. Exact gives (${vector.exact.x.toFixed(5)}, ${vector.exact.y.toFixed(5)}); the fast approximation gives (${vector.approximate.x.toFixed(5)}, ${vector.approximate.y.toFixed(5)}). Both point the same direction; the approximation is just slightly off unit length.`
    ];
    stageHost.textContent = stages[stage];
    tabs.forEach((button, i) => button.setAttribute("aria-pressed", String(i === stage)));
  };

  const onInput = () => draw();
  xInput.addEventListener("input", onInput);
  yInput.addEventListener("input", onInput);
  tabs.forEach(button => button.addEventListener("click", () => { stage = Number(button.dataset.stage ?? 0); draw(); }));
  host.querySelector<HTMLButtonElement>("[data-fisr-preset]")!.addEventListener("click", () => { xInput.value = "3"; yInput.value = "4"; draw(); });
  draw();
  return () => { xInput.removeEventListener("input", onInput); yInput.removeEventListener("input", onInput); };
}

registerLabModule({ id: "fast-inverse-sqrt", icon: "🧭", title: "Fast Inverse Square Root", description: "Normalize vectors, inspect IEEE-754 bits, decode the famous 0x5f3759df estimate, and watch Newton's method refine it.", featured: true, render: renderFastInverseSqrt });
