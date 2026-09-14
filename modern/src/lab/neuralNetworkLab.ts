import "./neuralNetworkLab.css";
import { registerLabModule } from "./moduleRegistry";
import { DATASETS, decisionBoundaryY, predict, trainNetwork, type Point2D } from "./neuralNetworkModel";

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
        <button type="button" data-nn-reset>Reset</button><button type="button" data-nn-prev>Previous</button><button type="button" data-nn-play>Play</button><button type="button" data-nn-next>Train One Step</button>
      </div>
      <section class="nn-grid">
        <div class="lab-panel"><div class="nn-heading"><div><span class="nn-kicker">Decision boundary</span><strong>What the model currently believes</strong></div><span data-nn-epoch></span></div><svg class="nn-plane" viewBox="0 0 420 420" role="img" aria-label="Training points and learned decision boundary"><line x1="210" y1="20" x2="210" y2="400" class="nn-axis"/><line x1="20" y1="210" x2="400" y2="210" class="nn-axis"/><g data-nn-boundary></g><g data-nn-points></g></svg><p class="lab-note">Points are labeled classes. The line is where the neuron predicts 50/50. As weights change, the line rotates and shifts.</p></div>
        <div class="lab-panel nn-state"><span class="nn-kicker">Inside the neuron</span><div><span>w₁</span><strong data-nn-w1></strong></div><div><span>w₂</span><strong data-nn-w2></strong></div><div><span>bias</span><strong data-nn-bias></strong></div><div><span>loss</span><strong data-nn-loss></strong></div><div><span>accuracy</span><strong data-nn-accuracy></strong></div><div><span>selected point probability</span><strong data-nn-probability></strong></div><p class="lab-note" data-nn-explain></p></div>
      </section>
      <section class="lab-panel"><div class="nn-heading"><div><span class="nn-kicker">Learning curve</span><strong>Loss over training</strong></div><span data-nn-loss-label></span></div><div class="nn-loss-chart" data-nn-loss-chart aria-label="Loss history"></div><input data-nn-scrub type="range" min="0" max="120" value="0" step="1" aria-label="Training epoch"></section>
      <section class="nn-three lab-panel"><span class="nn-kicker">Forward pass → loss → update</span><div><strong>1. Predict</strong><p class="lab-note">Compute z = w₁x + w₂y + b, then sigmoid(z) turns that score into a probability.</p></div><div><strong>2. Measure error</strong><p class="lab-note">Cross-entropy punishes confident wrong predictions more than uncertain ones.</p></div><div><strong>3. Follow the gradient</strong><p class="lab-note">Gradient descent nudges weights in the direction that reduces the average loss.</p></div></section>
      <section class="lab-panel nn-takeaway"><strong>Why this matters</strong><p class="lab-note">This tiny classifier is not a deep neural network, but it contains the core training loop used at much larger scales: parameters produce predictions, a loss measures error, gradients show how the parameters should change, and repeated updates improve the model.</p></section>
    </div>`;

  const datasetSelect = host.querySelector<HTMLSelectElement>("[data-nn-dataset]")!;
  const lrSelect = host.querySelector<HTMLSelectElement>("[data-nn-lr]")!;
  const prev = host.querySelector<HTMLButtonElement>("[data-nn-prev]")!;
  const play = host.querySelector<HTMLButtonElement>("[data-nn-play]")!;
  const next = host.querySelector<HTMLButtonElement>("[data-nn-next]")!;
  const reset = host.querySelector<HTMLButtonElement>("[data-nn-reset]")!;
  const scrub = host.querySelector<HTMLInputElement>("[data-nn-scrub]")!;
  const pointsGroup = host.querySelector<SVGGElement>("[data-nn-points]")!;
  const boundaryGroup = host.querySelector<SVGGElement>("[data-nn-boundary]")!;
  const chart = host.querySelector<HTMLElement>("[data-nn-loss-chart]")!;
  let snapshots = trainNetwork(DATASETS.diagonal, 120, 0.2);
  let index = 0;
  let timer: number | null = null;
  let selectedPoint = 0;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };
  const toPx = (value: number) => 210 + value * 70;
  const toPy = (value: number) => 210 - value * 70;

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
    host.querySelector<HTMLElement>("[data-nn-epoch]")!.textContent = `Epoch ${snapshot.epoch}`;
    host.querySelector<HTMLElement>("[data-nn-w1]")!.textContent = snapshot.weights.w1.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-w2]")!.textContent = snapshot.weights.w2.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-bias]")!.textContent = snapshot.weights.bias.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-loss]")!.textContent = snapshot.loss.toFixed(4);
    host.querySelector<HTMLElement>("[data-nn-accuracy]")!.textContent = `${(snapshot.accuracy * 100).toFixed(1)}%`;
    const point = dataset[selectedPoint] ?? dataset[0];
    const prediction = predict(point, snapshot.weights);
    host.querySelector<HTMLElement>("[data-nn-probability]")!.textContent = `${(prediction.probability * 100).toFixed(1)}% class 1`;
    host.querySelector<HTMLElement>("[data-nn-explain]")!.textContent = `Selected point (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) has true class ${point.label}. Current logit = ${prediction.logit.toFixed(3)}.`;

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
      circle.addEventListener("click", () => { selectedPoint = i; draw(); });
      circle.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectedPoint = i; draw(); } });
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

  datasetSelect.addEventListener("change", rebuild);
  lrSelect.addEventListener("change", rebuild);
  reset.addEventListener("click", rebuild);
  prev.addEventListener("click", () => { stop(); index = Math.max(0, index - 1); draw(); });
  next.addEventListener("click", () => { stop(); advance(); });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    if (index >= snapshots.length - 1) index = 0;
    play.textContent = "Pause";
    timer = window.setInterval(advance, 180);
    draw();
  });
  scrub.addEventListener("input", () => { stop(); index = Math.max(0, Math.min(snapshots.length - 1, Number(scrub.value))); draw(); });
  rebuild();
  return stop;
}

registerLabModule({ id: "train-neural-network", icon: "🧠", title: "Train a Neural Network", description: "Step through gradient descent and watch a neuron's decision boundary, loss, weights, and confidence change as it learns.", featured: true, render: renderNeuralNetwork });
