import "./neuralNetworkLab.css";
import { registerLabModule } from "./moduleRegistry";
import { DATASETS, batchGradient, decisionBoundaryY, pointGradient, predict, trainNetwork, type Point2D } from "./neuralNetworkModel";

function renderNeuralNetwork(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module nn-lab">
      <section class="nn-hero lab-panel">
        <div><span class="nn-kicker">Machine learning</span><h3>Watch a classifier learn.</h3><p class="lab-note">A single neuron can learn a linear decision boundary. Step through gradient descent and watch loss fall, weights change, and the boundary physically move.</p></div>
        <div class="nn-formula">z = w₁x + w₂y + b → σ(z) → loss → gradient → update</div>
      </section>
      <div class="lab-controls nn-controls">
        <label>Dataset<select data-nn-dataset><option value="diagonal">Clean diagonal</option><option value="noisy">Noisy diagonal</option></select></label>
        <label>Learning rate<select data-nn-lr><option value="0.03">0.03</option><option value="0.1">0.1</option><option value="0.2" selected>0.2</option><option value="0.8">0.8</option><option value="2">2.0</option></select></label>
        <button type="button" data-nn-xray aria-pressed="false">X-Ray Gradient</button><button type="button" data-nn-reset>Reset</button><button type="button" data-nn-prev>Previous</button><button type="button" data-nn-play>Play</button><button type="button" data-nn-next>Train One Step</button>
      </div>
      <section class="nn-grid">
        <div class="lab-panel"><div class="nn-heading"><div><span class="nn-kicker">Decision boundary</span><strong>What the model currently believes</strong></div><span data-nn-epoch></span></div><svg class="nn-plane" viewBox="0 0 420 420" role="img" aria-label="Training points and learned decision boundary"><line x1="210" y1="20" x2="210" y2="400" class="nn-axis"/><line x1="20" y1="210" x2="400" y2="210" class="nn-axis"/><g data-nn-boundary></g><g data-nn-points></g></svg><p class="lab-note">Select any point. The line is where the neuron predicts 50/50. As weights change, the line rotates and shifts.</p></div>
        <div class="lab-panel nn-state"><span class="nn-kicker">Inside the neuron</span><div><span>w₁</span><strong data-nn-w1></strong></div><div><span>w₂</span><strong data-nn-w2></strong></div><div><span>bias</span><strong data-nn-bias></strong></div><div><span>loss</span><strong data-nn-loss></strong></div><div><span>accuracy</span><strong data-nn-accuracy></strong></div><div><span>selected point probability</span><strong data-nn-probability></strong></div><p class="lab-note" data-nn-explain></p></div>
      </section>
      <section class="lab-panel nn-xray" data-nn-xray-panel hidden>
        <div class="nn-heading"><div><span class="nn-kicker">X-Ray Gradient Mode</span><strong>See the hidden numbers behind one update</strong></div><span data-nn-xray-epoch></span></div>
        <div class="nn-flow" aria-label="Selected point forward pass"><div><span>Inputs</span><strong data-nn-x-inputs></strong></div><b>→</b><div><span>Weighted sum z</span><strong data-nn-x-logit></strong></div><b>→</b><div><span>Sigmoid σ(z)</span><strong data-nn-x-prob></strong></div><b>→</b><div><span>Point loss</span><strong data-nn-x-loss></strong></div></div>
        <div class="nn-gradient-grid">
          <div><span class="nn-kicker">Selected point contributes</span><div class="nn-gradient-row"><span>∂L/∂w₁</span><strong data-nn-point-dw1></strong><small data-nn-point-w1-dir></small></div><div class="nn-gradient-row"><span>∂L/∂w₂</span><strong data-nn-point-dw2></strong><small data-nn-point-w2-dir></small></div><div class="nn-gradient-row"><span>∂L/∂b</span><strong data-nn-point-db></strong><small></small></div><p class="lab-note">One example contributes a gradient. It does not update the model by itself in this lab.</p></div>
          <div><span class="nn-kicker">Whole batch averages those votes</span><div class="nn-gradient-row"><span>avg ∂L/∂w₁</span><strong data-nn-batch-dw1></strong><small data-nn-batch-w1-dir></small></div><div class="nn-gradient-row"><span>avg ∂L/∂w₂</span><strong data-nn-batch-dw2></strong><small data-nn-batch-w2-dir></small></div><div class="nn-gradient-row"><span>avg ∂L/∂b</span><strong data-nn-batch-db></strong><small data-nn-batch-b-dir></small></div><p class="lab-note" data-nn-update-equation></p></div>
        </div>
        <div class="nn-predict-box"><strong>Predict before training one step</strong><p class="lab-note">According to the batch gradient, what will happen to w₁?</p><div class="nn-predict-actions"><button type="button" data-nn-guess="increase">Increase</button><button type="button" data-nn-guess="decrease">Decrease</button><button type="button" data-nn-guess="same">Stay about the same</button></div><p data-nn-feedback aria-live="polite"></p></div>
      </section>
      <section class="lab-panel"><div class="nn-heading"><div><span class="nn-kicker">Learning curve</span><strong>Loss over training</strong></div><span data-nn-loss-label></span></div><div class="nn-loss-chart" data-nn-loss-chart aria-label="Loss history"></div><input data-nn-scrub type="range" min="0" max="120" value="0" step="1" aria-label="Training epoch"></section>
      <section class="nn-three lab-panel"><span class="nn-kicker">Forward pass → loss → update</span><div><strong>1. Predict</strong><p class="lab-note">Compute z = w₁x + w₂y + b, then sigmoid(z) turns that score into a probability.</p></div><div><strong>2. Measure error</strong><p class="lab-note">Cross-entropy punishes confident wrong predictions more than uncertain ones.</p></div><div><strong>3. Follow the gradient</strong><p class="lab-note">Gradient descent subtracts learning-rate × average gradient from each parameter.</p></div></section>
      <section class="lab-panel nn-takeaway"><strong>Why this matters</strong><p class="lab-note">The boundary moves because every training example contributes a small vote on each parameter. X-Ray mode makes those normally invisible contributions visible, then shows how the batch average becomes the actual gradient-descent update.</p></section>
    </div>`;

  const datasetSelect = host.querySelector<HTMLSelectElement>("[data-nn-dataset]")!;
  const lrSelect = host.querySelector<HTMLSelectElement>("[data-nn-lr]")!;
  const prev = host.querySelector<HTMLButtonElement>("[data-nn-prev]")!;
  const play = host.querySelector<HTMLButtonElement>("[data-nn-play]")!;
  const next = host.querySelector<HTMLButtonElement>("[data-nn-next]")!;
  const reset = host.querySelector<HTMLButtonElement>("[data-nn-reset]")!;
  const xrayToggle = host.querySelector<HTMLButtonElement>("[data-nn-xray]")!;
  const xrayPanel = host.querySelector<HTMLElement>("[data-nn-xray-panel]")!;
  const scrub = host.querySelector<HTMLInputElement>("[data-nn-scrub]")!;
  const pointsGroup = host.querySelector<SVGGElement>("[data-nn-points]")!;
  const boundaryGroup = host.querySelector<SVGGElement>("[data-nn-boundary]")!;
  const chart = host.querySelector<HTMLElement>("[data-nn-loss-chart]")!;
  const controller = new AbortController();
  const { signal } = controller;
  let snapshots = trainNetwork(DATASETS.diagonal, 120, 0.2);
  let index = 0;
  let timer: number | null = null;
  let selectedPoint = 0;
  let xrayOpen = false;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };
  const toPx = (value: number) => 210 + value * 70;
  const toPy = (value: number) => 210 - value * 70;
  const direction = (gradient: number) => Math.abs(gradient) < 1e-8 ? "stay about the same" : gradient > 0 ? "decrease" : "increase";
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(5)}`;

  const rebuild = () => {
    stop();
    snapshots = trainNetwork(DATASETS[datasetSelect.value] ?? DATASETS.diagonal, 120, Number(lrSelect.value));
    index = 0;
    selectedPoint = 0;
    draw();
  };

  const draw = () => {
    const dataset = (DATASETS[datasetSelect.value] ?? DATASETS.diagonal) as readonly Point2D[];
    const snapshot = snapshots[index];
    const point = dataset[selectedPoint] ?? dataset[0];
    const prediction = predict(point, snapshot.weights);
    const pointGrad = pointGradient(point, snapshot.weights);
    const batchGrad = batchGradient(dataset, snapshot.weights);
    const lr = Math.max(0.001, Math.min(5, Number(lrSelect.value) || 0.1));

    host.querySelector<HTMLElement>("[data-nn-epoch]")!.textContent = `Epoch ${snapshot.epoch}`;
    host.querySelector<HTMLElement>("[data-nn-w1]")!.textContent = snapshot.weights.w1.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-w2]")!.textContent = snapshot.weights.w2.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-bias]")!.textContent = snapshot.weights.bias.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-loss]")!.textContent = snapshot.loss.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-accuracy]")!.textContent = `${(snapshot.accuracy * 100).toFixed(1)}%`;
    host.querySelector<HTMLElement>("[data-nn-probability]")!.textContent = `${(prediction.probability * 100).toFixed(1)}% class 1`;
    host.querySelector<HTMLElement>("[data-nn-explain]")!.textContent = `Selected point (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) has true class ${point.label}. Current logit = ${prediction.logit.toFixed(3)}.`;

    host.querySelector<HTMLElement>("[data-nn-xray-epoch]")!.textContent = `Epoch ${snapshot.epoch}`;
    host.querySelector<HTMLElement>("[data-nn-x-inputs]")!.textContent = `x=${point.x.toFixed(1)}, y=${point.y.toFixed(1)}, target=${point.label}`;
    host.querySelector<HTMLElement>("[data-nn-x-logit]")!.textContent = `${snapshot.weights.w1.toFixed(3)}×${point.x.toFixed(1)} + ${snapshot.weights.w2.toFixed(3)}×${point.y.toFixed(1)} + ${snapshot.weights.bias.toFixed(3)} = ${prediction.logit.toFixed(4)}`;
    host.querySelector<HTMLElement>("[data-nn-x-prob]")!.textContent = pointGrad.probability.toFixed(5);
    host.querySelector<HTMLElement>("[data-nn-x-loss]")!.textContent = pointGrad.loss.toFixed(5);
    host.querySelector<HTMLElement>("[data-nn-point-dw1]")!.textContent = signed(pointGrad.dw1);
    host.querySelector<HTMLElement>("[data-nn-point-dw2]")!.textContent = signed(pointGrad.dw2);
    host.querySelector<HTMLElement>("[data-nn-point-db]")!.textContent = signed(pointGrad.db);
    host.querySelector<HTMLElement>("[data-nn-point-w1-dir]")!.textContent = `alone would push w₁ to ${direction(pointGrad.dw1)}`;
    host.querySelector<HTMLElement>("[data-nn-point-w2-dir]")!.textContent = `alone would push w₂ to ${direction(pointGrad.dw2)}`;
    host.querySelector<HTMLElement>("[data-nn-batch-dw1]")!.textContent = signed(batchGrad.dw1);
    host.querySelector<HTMLElement>("[data-nn-batch-dw2]")!.textContent = signed(batchGrad.dw2);
    host.querySelector<HTMLElement>("[data-nn-batch-db]")!.textContent = signed(batchGrad.db);
    host.querySelector<HTMLElement>("[data-nn-batch-w1-dir]")!.textContent = `w₁ will ${direction(batchGrad.dw1)}`;
    host.querySelector<HTMLElement>("[data-nn-batch-w2-dir]")!.textContent = `w₂ will ${direction(batchGrad.dw2)}`;
    host.querySelector<HTMLElement>("[data-nn-batch-b-dir]")!.textContent = `bias will ${direction(batchGrad.db)}`;
    const nextW1 = snapshot.weights.w1 - lr * batchGrad.dw1;
    host.querySelector<HTMLElement>("[data-nn-update-equation]")!.textContent = `w₁ next = ${snapshot.weights.w1.toFixed(4)} − ${lr.toFixed(3)} × (${batchGrad.dw1.toFixed(5)}) = ${nextW1.toFixed(4)}.`;

    pointsGroup.replaceChildren();
    dataset.forEach((p, i) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(toPx(p.x)));
      circle.setAttribute("cy", String(toPy(p.y)));
      circle.setAttribute("r", i === selectedPoint ? "11" : "8");
      circle.setAttribute("class", `nn-point class-${p.label}${i === selectedPoint ? " selected" : ""}`);
      circle.setAttribute("tabindex", "0");
      circle.setAttribute("role", "button");
      circle.setAttribute("aria-label", `Point ${i + 1}, class ${p.label}`);
      circle.addEventListener("click", () => { selectedPoint = i; draw(); }, { signal });
      circle.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectedPoint = i; draw(); } }, { signal });
      pointsGroup.append(circle);
    });

    boundaryGroup.replaceChildren();
    const y1 = decisionBoundaryY(-2.7, snapshot.weights);
    const y2 = decisionBoundaryY(2.7, snapshot.weights);
    if (y1 !== null && y2 !== null) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(toPx(-2.7)));
      line.setAttribute("x2", String(toPx(2.7)));
      line.setAttribute("y1", String(toPy(y1)));
      line.setAttribute("y2", String(toPy(y2)));
      line.setAttribute("class", "nn-boundary-line");
      boundaryGroup.append(line);
    }

    chart.replaceChildren();
    const visible = snapshots.slice(0, index + 1);
    const maxLoss = Math.max(0.001, ...visible.map(item => item.loss));
    visible.forEach(item => {
      const bar = document.createElement("span");
      bar.className = "nn-loss-bar";
      bar.style.height = `${Math.max(3, (item.loss / maxLoss) * 100)}%`;
      bar.title = `Epoch ${item.epoch}: ${item.loss.toFixed(4)}`;
      chart.append(bar);
    });
    host.querySelector<HTMLElement>("[data-nn-loss-label]")!.textContent = `Start ${snapshots[0].loss.toFixed(3)} → now ${snapshot.loss.toFixed(3)}`;
    scrub.value = String(index);
    scrub.max = String(snapshots.length - 1);
    prev.disabled = index === 0;
    next.disabled = index >= snapshots.length - 1;
  };

  const advance = () => {
    if (index >= snapshots.length - 1) return stop();
    index++;
    draw();
  };

  datasetSelect.addEventListener("change", rebuild, { signal });
  lrSelect.addEventListener("change", rebuild, { signal });
  reset.addEventListener("click", rebuild, { signal });
  prev.addEventListener("click", () => { stop(); index = Math.max(0, index - 1); draw(); }, { signal });
  next.addEventListener("click", () => { stop(); advance(); }, { signal });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    if (index >= snapshots.length - 1) index = 0;
    play.textContent = "Pause";
    timer = window.setInterval(advance, 180);
    draw();
  }, { signal });
  scrub.addEventListener("input", () => { stop(); index = Math.max(0, Math.min(snapshots.length - 1, Number(scrub.value))); draw(); }, { signal });
  xrayToggle.addEventListener("click", () => {
    xrayOpen = !xrayOpen;
    xrayPanel.hidden = !xrayOpen;
    xrayToggle.setAttribute("aria-pressed", String(xrayOpen));
    xrayToggle.textContent = xrayOpen ? "Hide X-Ray" : "X-Ray Gradient";
  }, { signal });
  host.querySelectorAll<HTMLButtonElement>("[data-nn-guess]").forEach(button => button.addEventListener("click", () => {
    const dataset = (DATASETS[datasetSelect.value] ?? DATASETS.diagonal) as readonly Point2D[];
    const gradient = batchGradient(dataset, snapshots[index].weights);
    const correct = direction(gradient.dw1);
    const guess = button.dataset.nnGuess === "same" ? "stay about the same" : button.dataset.nnGuess;
    host.querySelector<HTMLElement>("[data-nn-feedback]")!.textContent = guess === correct
      ? `Correct. Gradient descent subtracts the gradient, so w₁ will ${correct}.`
      : `Not this time. The average ∂L/∂w₁ is ${signed(gradient.dw1)}, so subtracting it makes w₁ ${correct}.`;
  }, { signal }));

  rebuild();
  return () => { stop(); controller.abort(); };
}

registerLabModule({ id: "train-neural-network", icon: "🧠", title: "Train a Neural Network", description: "Step through gradient descent and use X-Ray mode to see per-example gradients, batch updates, decision boundaries, loss, and confidence change as a neuron learns.", featured: true, render: renderNeuralNetwork });
