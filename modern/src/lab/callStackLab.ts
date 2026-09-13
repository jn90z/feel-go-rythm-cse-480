import "./callStackLab.css";
import { buildCallStackTrace, type RecursiveExample } from "./callStackModel";

export {};

function renderCallStack(host: HTMLElement): void {
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
        <button id="callStackPrev" type="button">Previous</button>
        <button id="callStackPlay" type="button">Play</button>
        <button id="callStackNext" type="button">Next</button>
      </div>
      <div class="call-stack-metrics">
        <span id="callStackStep"></span>
        <span id="callStackResult"></span>
        <span id="callStackCalls"></span>
        <span id="callStackDepth"></span>
      </div>
      <div class="call-stack-layout">
        <div class="lab-panel">
          <strong>Live call stack</strong>
          <div id="callStackFrames" class="call-stack-frames" aria-live="polite"></div>
        </div>
        <div class="lab-panel">
          <strong>Execution trace</strong>
          <div id="callStackEvents" class="call-stack-event-list"></div>
        </div>
      </div>
      <div class="lab-panel call-stack-explanation">
        <strong>Why did this happen?</strong>
        <p id="callStackWhy"></p>
      </div>
    </div>`;

  const example = host.querySelector<HTMLSelectElement>("#callStackExample")!;
  const input = host.querySelector<HTMLInputElement>("#callStackN")!;
  const play = host.querySelector<HTMLButtonElement>("#callStackPlay")!;
  const frames = host.querySelector<HTMLElement>("#callStackFrames")!;
  const events = host.querySelector<HTMLElement>("#callStackEvents")!;
  const why = host.querySelector<HTMLElement>("#callStackWhy")!;
  let trace = buildCallStackTrace("fibonacci", 5);
  let index = 0;
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };

  const draw = () => {
    const event = trace.events[index];
    frames.innerHTML = event.stack.length
      ? event.stack.map((label, frameIndex) => `
          <div class="call-stack-frame ${frameIndex === event.stack.length - 1 ? "current" : ""}">
            <strong>${label}</strong>
            <small>frame ${frameIndex + 1}</small>
          </div>`).join("")
      : `<div class="lab-note">The call stack is empty.</div>`;

    events.innerHTML = trace.events.map((item, eventIndex) => `
      <button class="call-stack-event ${eventIndex === index ? "active" : ""}" type="button" data-call-event="${eventIndex}">
        ${eventIndex + 1}. ${item.kind.toUpperCase()} ${item.functionName}(${item.argument})${item.value === undefined ? "" : ` → ${item.value}`}
      </button>`).join("");

    events.querySelectorAll<HTMLButtonElement>("[data-call-event]").forEach(button => {
      button.addEventListener("click", () => {
        stop();
        index = Number(button.dataset.callEvent);
        draw();
      });
    });

    events.querySelector<HTMLElement>(".active")?.scrollIntoView({ block: "nearest" });
    why.textContent = event.explanation;
    host.querySelector<HTMLElement>("#callStackStep")!.innerHTML = `<strong>Step:</strong> ${index + 1}/${trace.events.length}`;
    host.querySelector<HTMLElement>("#callStackResult")!.innerHTML = `<strong>Result:</strong> ${trace.result}`;
    host.querySelector<HTMLElement>("#callStackCalls")!.innerHTML = `<strong>Calls:</strong> ${trace.calls}`;
    host.querySelector<HTMLElement>("#callStackDepth")!.innerHTML = `<strong>Max depth:</strong> ${trace.maxDepth}`;
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
    draw();
  };

  host.querySelector("#callStackBuild")!.addEventListener("click", rebuild);
  example.addEventListener("change", rebuild);
  host.querySelector("#callStackPrev")!.addEventListener("click", () => {
    stop();
    index = Math.max(0, index - 1);
    draw();
  });
  host.querySelector("#callStackNext")!.addEventListener("click", () => {
    stop();
    index = Math.min(trace.events.length - 1, index + 1);
    draw();
  });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    play.textContent = "Pause";
    timer = window.setInterval(() => {
      if (index >= trace.events.length - 1) return stop();
      index++;
      draw();
    }, 550);
  });

  draw();

  const overlay = document.querySelector<HTMLElement>(".lab-overlay");
  if (overlay) {
    const cleanupObserver = new MutationObserver(() => {
      if (overlay.hidden || !host.isConnected) {
        stop();
        cleanupObserver.disconnect();
      }
    });
    cleanupObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  }
}

function installCallStackCard(): void {
  const overlay = document.querySelector<HTMLElement>(".lab-overlay");
  const body = overlay?.querySelector<HTMLElement>(".lab-body");
  const heading = overlay?.querySelector<HTMLHeadingElement>("h2");
  const back = overlay?.querySelector<HTMLButtonElement>(".lab-back");
  if (!overlay || !body || !heading || !back) return;

  const addCard = () => {
    const grid = body.querySelector<HTMLElement>(".lab-home-grid");
    if (!grid || grid.querySelector("[data-advanced-module='call-stack']")) return;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "lab-card lab-card-featured";
    card.dataset.advancedModule = "call-stack";
    card.innerHTML = `<span class="lab-icon">↳□</span><h3>Recursion Call Stack</h3><p>Step through stack-frame creation, base cases, returns, and unwinding for Fibonacci and factorial.</p>`;
    card.addEventListener("click", () => {
      back.hidden = false;
      heading.textContent = "Recursion Call Stack";
      body.replaceChildren();
      const host = document.createElement("div");
      body.append(host);
      renderCallStack(host);
    });
    grid.append(card);
  };

  const observer = new MutationObserver(addCard);
  observer.observe(body, { childList: true, subtree: true });
  addCard();
}

installCallStackCard();
