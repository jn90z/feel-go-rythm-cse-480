import "./turingMachineLab.css";
import { registerLabModule } from "./moduleRegistry";
import { getTuringMachine, simulateTuringMachine, tapeWindow, TURING_MACHINES, type TuringSnapshot } from "./turingMachineModel";

function createCell(index: number, symbol: string, head: number): HTMLElement {
  const cell = document.createElement("div");
  cell.className = `tm-cell${index === head ? " tm-cell-head" : ""}`;
  const position = document.createElement("small");
  position.textContent = String(index);
  const value = document.createElement("strong");
  value.textContent = symbol;
  cell.append(position, value);
  if (index === head) {
    const marker = document.createElement("span");
    marker.className = "tm-head-marker";
    marker.textContent = "▲ HEAD";
    cell.append(marker);
  }
  return cell;
}

function renderTuringMachine(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module turing-machine-lab">
      <section class="tm-hero lab-panel">
        <div><span class="tm-kicker">Theory of computation</span><h3>One tape. One head. A tiny rule table.</h3><p class="lab-note">A Turing machine repeatedly reads one symbol, writes one symbol, moves left or right, and changes state. That simple model is powerful enough to describe any algorithmic computation.</p></div>
        <div class="tm-formula" aria-label="Turing machine step">READ → WRITE → MOVE → STATE</div>
      </section>
      <div class="lab-controls tm-controls">
        <label>Machine<select data-tm-machine></select></label>
        <label>Input<input data-tm-input type="text" maxlength="24" value="1011" autocomplete="off" spellcheck="false"></label>
        <button type="button" data-tm-reset>Reset</button>
        <button type="button" data-tm-prev>Previous</button>
        <button type="button" data-tm-play>Play</button>
        <button type="button" data-tm-next>Next</button>
        <label>Speed<select data-tm-speed><option value="1000">0.5×</option><option value="600" selected>1×</option><option value="300">2×</option><option value="150">4×</option></select></label>
      </div>
      <section class="tm-status lab-panel" aria-live="polite">
        <div><span>State</span><strong data-tm-state></strong></div>
        <div><span>Step</span><strong data-tm-step></strong></div>
        <div><span>Reading</span><strong data-tm-read></strong></div>
        <div><span>Status</span><strong data-tm-status></strong></div>
      </section>
      <section class="tm-tape-panel lab-visual">
        <div class="tm-tape-heading"><div><strong>Infinite tape</strong><p class="lab-note">Only a small window is shown. Blank cells continue forever in both directions.</p></div><span data-tm-head-position></span></div>
        <div class="tm-tape" data-tm-tape></div>
      </section>
      <section class="tm-decision-grid">
        <div class="lab-panel tm-rule-card">
          <span class="tm-kicker">Current transition</span>
          <div class="tm-rule-flow" data-tm-rule-flow></div>
          <p class="lab-note" data-tm-message></p>
        </div>
        <div class="lab-panel tm-predict-card">
          <span class="tm-kicker">Predict before stepping</span>
          <strong>Which way will the head move?</strong>
          <div class="tm-predict-buttons" data-tm-predict>
            <button type="button" data-direction="L">← Left</button>
            <button type="button" data-direction="S">Stay</button>
            <button type="button" data-direction="R">Right →</button>
          </div>
          <p class="lab-note" data-tm-feedback>Choose a direction, then advance one step to see the rule execute.</p>
        </div>
      </section>
      <section class="lab-panel tm-timeline-panel">
        <div class="tm-timeline-heading"><strong>Execution timeline</strong><span data-tm-timeline-label></span></div>
        <input data-tm-scrub type="range" min="0" value="0" step="1" aria-label="Turing machine execution step">
      </section>
      <section class="lab-panel tm-rules-panel">
        <div class="tm-rules-heading"><div><strong>Transition table</strong><p class="lab-note" data-tm-description></p></div><span class="tm-rule-notation">δ(state, read) = (state, write, move)</span></div>
        <div class="tm-rule-list" data-tm-rules></div>
      </section>
      <section class="lab-panel tm-takeaway">
        <strong>Why this matters</strong>
        <p class="lab-note">Real computers are much faster and more complicated, but the Turing machine gives computer science a precise way to ask a deeper question: <em>Can this problem be computed at all?</em> It separates implementation details from the fundamental limits of algorithms.</p>
      </section>
    </div>`;

  const machineSelect = host.querySelector<HTMLSelectElement>("[data-tm-machine]")!;
  const input = host.querySelector<HTMLInputElement>("[data-tm-input]")!;
  const reset = host.querySelector<HTMLButtonElement>("[data-tm-reset]")!;
  const prev = host.querySelector<HTMLButtonElement>("[data-tm-prev]")!;
  const play = host.querySelector<HTMLButtonElement>("[data-tm-play]")!;
  const next = host.querySelector<HTMLButtonElement>("[data-tm-next]")!;
  const speed = host.querySelector<HTMLSelectElement>("[data-tm-speed]")!;
  const scrub = host.querySelector<HTMLInputElement>("[data-tm-scrub]")!;
  const tape = host.querySelector<HTMLElement>("[data-tm-tape]")!;
  const state = host.querySelector<HTMLElement>("[data-tm-state]")!;
  const step = host.querySelector<HTMLElement>("[data-tm-step]")!;
  const read = host.querySelector<HTMLElement>("[data-tm-read]")!;
  const status = host.querySelector<HTMLElement>("[data-tm-status]")!;
  const headPosition = host.querySelector<HTMLElement>("[data-tm-head-position]")!;
  const ruleFlow = host.querySelector<HTMLElement>("[data-tm-rule-flow]")!;
  const message = host.querySelector<HTMLElement>("[data-tm-message]")!;
  const feedback = host.querySelector<HTMLElement>("[data-tm-feedback]")!;
  const timelineLabel = host.querySelector<HTMLElement>("[data-tm-timeline-label]")!;
  const description = host.querySelector<HTMLElement>("[data-tm-description]")!;
  const rules = host.querySelector<HTMLElement>("[data-tm-rules]")!;
  const predictButtons = [...host.querySelectorAll<HTMLButtonElement>("[data-direction]")];

  for (const machine of TURING_MACHINES) {
    const option = document.createElement("option");
    option.value = machine.id;
    option.textContent = machine.title;
    machineSelect.append(option);
  }

  let run = simulateTuringMachine(getTuringMachine(machineSelect.value), input.value);
  let index = 0;
  let timer: number | null = null;
  let prediction: string | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };

  const current = (): TuringSnapshot => run.snapshots[index];

  const renderRules = () => {
    rules.replaceChildren();
    for (const transition of run.machine.transitions) {
      const row = document.createElement("div");
      row.className = "tm-rule-row";
      const active = current().transition === transition;
      if (active) row.classList.add("active");
      const from = document.createElement("code");
      from.textContent = `${transition.state} + ${transition.read}`;
      const arrow = document.createElement("span");
      arrow.textContent = "→";
      const to = document.createElement("code");
      const move = transition.move === "L" ? "←" : transition.move === "R" ? "→" : "•";
      to.textContent = `${transition.nextState}, write ${transition.write}, ${move}`;
      row.append(from, arrow, to);
      rules.append(row);
    }
  };

  const draw = () => {
    const snapshot = current();
    tape.replaceChildren(...tapeWindow(snapshot, run.machine.blank, 5).map(cell => createCell(cell.index, cell.symbol, snapshot.head)));
    state.textContent = snapshot.state;
    step.textContent = `${snapshot.step} / ${run.snapshots.length - 1}`;
    read.textContent = snapshot.read;
    status.textContent = snapshot.accepted ? "Accepted ✓" : snapshot.rejected ? "Rejected" : snapshot.halted ? "Halted" : "Running";
    status.className = snapshot.accepted ? "tm-accepted" : snapshot.rejected ? "tm-rejected" : "";
    headPosition.textContent = `Head at cell ${snapshot.head}`;
    message.textContent = snapshot.message;
    description.textContent = run.machine.description;
    timelineLabel.textContent = `Snapshot ${index + 1} of ${run.snapshots.length}`;
    scrub.max = String(Math.max(0, run.snapshots.length - 1));
    scrub.value = String(index);
    prev.disabled = index === 0;
    next.disabled = index >= run.snapshots.length - 1;

    ruleFlow.replaceChildren();
    if (snapshot.transition) {
      const pieces = [
        `Read ${snapshot.transition.read}`,
        `Write ${snapshot.transition.write}`,
        snapshot.transition.move === "L" ? "Move LEFT" : snapshot.transition.move === "R" ? "Move RIGHT" : "STAY",
        `State → ${snapshot.transition.nextState}`
      ];
      pieces.forEach((text, pieceIndex) => {
        const chip = document.createElement("span");
        chip.textContent = text;
        ruleFlow.append(chip);
        if (pieceIndex < pieces.length - 1) {
          const arrow = document.createElement("b");
          arrow.textContent = "→";
          ruleFlow.append(arrow);
        }
      });
    } else {
      const halted = document.createElement("span");
      halted.textContent = snapshot.accepted ? "HALT · ACCEPT" : snapshot.rejected ? "HALT · REJECT" : "HALT";
      ruleFlow.append(halted);
    }

    predictButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.direction === prediction));
      button.disabled = !snapshot.transition;
    });
    renderRules();
  };

  const rebuild = () => {
    stop();
    run = simulateTuringMachine(getTuringMachine(machineSelect.value), input.value);
    index = 0;
    prediction = null;
    feedback.textContent = "Choose a direction, then advance one step to see the rule execute.";
    draw();
  };

  const advance = () => {
    if (index >= run.snapshots.length - 1) return stop();
    const before = current();
    if (prediction && before.transition) {
      feedback.textContent = prediction === before.transition.move
        ? `Correct — the rule moves ${before.transition.move === "L" ? "left" : before.transition.move === "R" ? "right" : "nowhere"}.`
        : `Not this time — this rule moves ${before.transition.move === "L" ? "left" : before.transition.move === "R" ? "right" : "nowhere"}.`;
    }
    prediction = null;
    index++;
    draw();
  };

  reset.addEventListener("click", rebuild);
  machineSelect.addEventListener("change", () => {
    input.value = machineSelect.value === "unary-increment" ? "111" : machineSelect.value === "erase" ? "10101" : "1011";
    rebuild();
  });
  input.addEventListener("change", rebuild);
  prev.addEventListener("click", () => { stop(); prediction = null; index = Math.max(0, index - 1); draw(); });
  next.addEventListener("click", () => { stop(); advance(); });
  scrub.addEventListener("input", () => {
    stop();
    const requested = Number.parseInt(scrub.value, 10);
    index = Number.isFinite(requested) ? Math.max(0, Math.min(run.snapshots.length - 1, requested)) : 0;
    prediction = null;
    draw();
  });
  speed.addEventListener("change", () => {
    if (timer === null) return;
    stop();
    play.click();
  });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    if (index >= run.snapshots.length - 1) index = 0;
    play.textContent = "Pause";
    timer = window.setInterval(advance, Number(speed.value));
    draw();
  });
  predictButtons.forEach(button => button.addEventListener("click", () => {
    prediction = button.dataset.direction ?? null;
    predictButtons.forEach(candidate => candidate.setAttribute("aria-pressed", String(candidate === button)));
    feedback.textContent = "Prediction locked in. Press Next to test it.";
  }));

  rebuild();
  return stop;
}

registerLabModule({
  id: "turing-machine",
  icon: "🎞️",
  title: "Turing Machine",
  description: "Step through an infinite tape, read/write head, states, and transition rules to see what computation means at its most fundamental level.",
  featured: true,
  render: renderTuringMachine
});
