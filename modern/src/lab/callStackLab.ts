import "./callStackLab.css";
import { buildCallStackTrace, type CallEventKind, type RecursiveExample } from "./callStackModel";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";

const SPEEDS: Record<string, number> = {
  "0.5": 900,
  "1": 550,
  "2": 275,
  "4": 140
};

const EVENT_LABEL: Record<CallEventKind, string> = {
  enter: "CALL",
  base: "BASE CASE",
  return: "RETURN"
};

function renderCallStack(host: HTMLElement): LabModuleCleanup {
  host.innerHTML = `
    <div class="lab-module">
      <div class="lab-controls">
        <label>Example
          <select id="callStackExample">
            <option value="fibonacci">Fibonacci</option>
            <option value="factorial">Factorial</option>
          </select>
        </label>
        <label>n
          <input id="callStackN" type="number" min="0" max="8" value="5" />
        </label>
        <button id="callStackBuild" type="button">Build Trace</button>
        <button id="callStackFib4" type="button">Fib 4</button>
        <button id="callStackFib6" type="button">Fib 6</button>
        <button id="callStackFact5" type="button">Fact 5</button>
        <button id="callStackPrev" type="button">Previous</button>
        <button id="callStackPlay" type="button">Play</button>
        <button id="callStackNext" type="button">Next</button>
        <label>Speed
          <select id="callStackSpeed">
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="2">2×</option>
            <option value="4">4×</option>
          </select>
        </label>
      </div>
      <div class="call-stack-metrics" aria-live="polite">
        <span id="callStackStep"></span>
        <span id="callStackResult"></span>
        <span id="callStackCalls"></span>
        <span id="callStackDepth"></span>
      </div>
      <label class="call-stack-timeline-label">
        <span>Execution timeline</span>
        <input id="callStackTimeline" class="call-stack-timeline" type="range" min="0" value="0" />
      </label>
      <div class="call-stack-layout">
        <div class="lab-panel">
          <strong>Live call stack</strong>
          <p class="lab-note">The highlighted frame is currently executing. New calls push frames; returns remove them.</p>
          <div id="callStackFrames" class="call-stack-frames" aria-live="polite"></div>
        </div>
        <div class="lab-panel">
          <strong>Execution trace</strong>
          <p class="lab-note">Click any event to jump directly to that moment.</p>
          <div id="callStackEvents" class="call-stack-event-list"></div>
        </div>
      </div>
      <div class="lab-panel call-stack-predict">
        <strong>Predict the next event</strong>
        <p class="lab-note">Before pressing Next, decide what recursion will do next.</p>
        <div class="call-stack-predict-buttons">
          <button type="button" data-predict="enter">CALL</button>
          <button type="button" data-predict="base">BASE CASE</button>
          <button type="button" data-predict="return">RETURN</button>
        </div>
        <p id="callStackPrediction" class="call-stack-prediction" role="status" aria-live="polite">Make a prediction, then step forward to check your mental model.</p>
      </div>
      <div class="lab-panel call-stack-explanation">
        <strong>Why did this happen?</strong>
        <p id="callStackWhy"></p>
      </div>
    </div>`;

  const example = host.querySelector<HTMLSelectElement>("#callStackExample")!;
  const input = host.querySelector<HTMLInputElement>("#callStackN")!;
  const play = host.querySelector<HTMLButtonElement>("#callStackPlay")!;
  const speed = host.querySelector<HTMLSelectElement>("#callStackSpeed")!;
  const timeline = host.querySelector<HTMLInputElement>("#callStackTimeline")!;
  const frames = host.querySelector<HTMLElement>("#callStackFrames")!;
  const events = host.querySelector<HTMLElement>("#callStackEvents")!;
  const why = host.querySelector<HTMLElement>("#callStackWhy")!;
  const prediction = host.querySelector<HTMLElement>("#callStackPrediction")!;
  let trace = buildCallStackTrace("fibonacci", 5);
  let index = 0;
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };

  const clearPrediction = () => {
    prediction.textContent = index < trace.events.length - 1
      ? "Make a prediction, then step forward to check your mental model."
      : "Trace complete. Move backward to predict an earlier event.";
    prediction.classList.remove("correct", "incorrect");
  };

  const draw = () => {
    const event = trace.events[index];
    timeline.max = String(Math.max(0, trace.events.length - 1));
    timeline.value = String(index);

    frames.replaceChildren();
    if (!event.stack.length) {
      const empty = document.createElement("div");
      empty.className = "lab-note";
      empty.textContent = "The call stack is empty.";
      frames.append(empty);
    } else {
      event.stack.forEach((label, frameIndex) => {
        const frame = document.createElement("div");
        frame.className = `call-stack-frame${frameIndex === event.stack.length - 1 ? " current" : ""}`;
        const name = document.createElement("strong");
        name.textContent = label;
        const depth = document.createElement("small");
        depth.textContent = `frame ${frameIndex + 1}`;
        frame.append(name, depth);
        frames.append(frame);
      });
    }

    events.replaceChildren();
    trace.events.forEach((item, eventIndex) => {
      const button = document.createElement("button");
      button.className = `call-stack-event${eventIndex === index ? " active" : ""}`;
      button.type = "button";
      button.dataset.callEvent = String(eventIndex);
      button.textContent = `${eventIndex + 1}. ${EVENT_LABEL[item.kind]} ${item.functionName}(${item.argument})${item.value === undefined ? "" : ` → ${item.value}`}`;
      button.addEventListener("click", () => {
        stop();
        index = eventIndex;
        clearPrediction();
        draw();
      });
      events.append(button);
    });

    events.querySelector<HTMLElement>(".active")?.scrollIntoView({ block: "nearest" });
    why.textContent = event.explanation;
    host.querySelector<HTMLElement>("#callStackStep")!.textContent = `Step: ${index + 1}/${trace.events.length}`;
    host.querySelector<HTMLElement>("#callStackResult")!.textContent = `Final result: ${trace.result}`;
    host.querySelector<HTMLElement>("#callStackCalls")!.textContent = `Total calls: ${trace.calls}`;
    host.querySelector<HTMLElement>("#callStackDepth")!.textContent = `Max depth: ${trace.maxDepth}`;
  };

  const rebuild = () => {
    stop();
    const selected = example.value as RecursiveExample;
    const max = selected === "fibonacci" ? 8 : 10;
    const parsed = Number.parseInt(input.value, 10);
    const n = Number.isFinite(parsed) ? Math.max(0, Math.min(max, parsed)) : 5;
    input.value = String(n);
    input.max = String(max);
    trace = buildCallStackTrace(selected, n);
    index = 0;
    clearPrediction();
    draw();
  };

  const loadPreset = (selected: RecursiveExample, n: number) => {
    example.value = selected;
    input.value = String(n);
    rebuild();
  };

  const startPlayback = () => {
    stop();
    if (index >= trace.events.length - 1) index = 0;
    play.textContent = "Pause";
    const delay = SPEEDS[speed.value] ?? SPEEDS["1"];
    timer = window.setInterval(() => {
      if (index >= trace.events.length - 1) return stop();
      index++;
      clearPrediction();
      draw();
    }, delay);
  };

  host.querySelector("#callStackBuild")!.addEventListener("click", rebuild);
  host.querySelector("#callStackFib4")!.addEventListener("click", () => loadPreset("fibonacci", 4));
  host.querySelector("#callStackFib6")!.addEventListener("click", () => loadPreset("fibonacci", 6));
  host.querySelector("#callStackFact5")!.addEventListener("click", () => loadPreset("factorial", 5));
  example.addEventListener("change", rebuild);
  timeline.addEventListener("input", () => {
    stop();
    index = Math.max(0, Math.min(trace.events.length - 1, Number(timeline.value)));
    clearPrediction();
    draw();
  });
  speed.addEventListener("change", () => {
    if (timer !== null) startPlayback();
  });
  host.querySelector("#callStackPrev")!.addEventListener("click", () => {
    stop();
    index = Math.max(0, index - 1);
    clearPrediction();
    draw();
  });
  host.querySelector("#callStackNext")!.addEventListener("click", () => {
    stop();
    index = Math.min(trace.events.length - 1, index + 1);
    clearPrediction();
    draw();
  });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    startPlayback();
    draw();
  });
  host.querySelectorAll<HTMLButtonElement>("[data-predict]").forEach(button => {
    button.addEventListener("click", () => {
      stop();
      if (index >= trace.events.length - 1) {
        clearPrediction();
        return;
      }
      const guessed = button.dataset.predict as CallEventKind;
      const actual = trace.events[index + 1].kind;
      const correct = guessed === actual;
      prediction.classList.toggle("correct", correct);
      prediction.classList.toggle("incorrect", !correct);
      prediction.textContent = correct
        ? `Correct — the next event is ${EVENT_LABEL[actual]}. Now press Next and watch why.`
        : `Not quite. The next event is ${EVENT_LABEL[actual]}. Press Next and use the explanation to see why.`;
    });
  });

  clearPrediction();
  draw();
  return stop;
}

registerLabModule({
  id: "call-stack",
  icon: "↳□",
  title: "Recursion Call Stack",
  description: "Scrub, predict and step through stack-frame creation, base cases and returns for Fibonacci and factorial.",
  featured: true,
  render: renderCallStack
});
