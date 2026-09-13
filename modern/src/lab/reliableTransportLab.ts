import "./reliableTransportLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import {
  compareReliableTransport,
  normalizeTransportInput,
  simulateReliableTransport,
  type ReliabilityMode,
  type TransportEventKind,
  type TransportSimulation
} from "./reliableTransportModel";

const EVENT_LABELS: Record<TransportEventKind, string> = {
  send: "SEND",
  deliver: "DELIVER",
  drop: "DROP",
  discard: "DISCARD",
  ack: "ACK",
  timeout: "TIMEOUT",
  complete: "COMPLETE"
};

const SPEEDS = [
  { label: "0.5×", delay: 1100 },
  { label: "1×", delay: 650 },
  { label: "2×", delay: 325 },
  { label: "4×", delay: 165 }
] as const;

function renderReliableTransport(host: HTMLElement): LabModuleCleanup {
  host.innerHTML = `
    <div class="lab-module reliable-transport">
      <div class="lab-controls">
        <label>Protocol
          <select id="transportMode">
            <option value="go-back-n">Go-Back-N</option>
            <option value="stop-and-wait">Stop-and-Wait</option>
          </select>
        </label>
        <label>Packets
          <input id="transportPackets" type="number" min="1" max="12" value="6" />
        </label>
        <label>Window
          <input id="transportWindow" type="number" min="1" max="6" value="4" />
        </label>
        <label>Drop first attempt of packet
          <select id="transportLoss"><option value="none">No loss</option></select>
        </label>
        <label>Speed
          <select id="transportSpeed"></select>
        </label>
        <button id="transportBuild" type="button">Build Trace</button>
        <button id="transportPrev" type="button">Previous</button>
        <button id="transportPlay" type="button">Play</button>
        <button id="transportNext" type="button">Next</button>
        <button id="transportCompare" type="button">Compare Protocols</button>
      </div>

      <div class="transport-presets" aria-label="Reliable transport example scenarios">
        <span class="lab-note">Try a scenario:</span>
        <button type="button" data-transport-preset="clean">No loss pipeline</button>
        <button type="button" data-transport-preset="middle-loss">Middle packet loss</button>
        <button type="button" data-transport-preset="early-loss">Early loss + discards</button>
        <button type="button" data-transport-preset="stop-wait">Stop-and-Wait loss</button>
      </div>

      <div class="transport-timeline-panel lab-panel">
        <div class="transport-timeline-heading">
          <strong>Execution timeline</strong>
          <span id="transportTimelineLabel" class="lab-note"></span>
        </div>
        <input id="transportTimeline" class="transport-timeline" type="range" min="0" max="0" value="0" aria-label="Transport trace step" />
        <div id="transportEventTrail" class="transport-event-trail" aria-label="Transport event history"></div>
      </div>

      <div class="transport-metrics" aria-live="polite">
        <span id="transportStep"></span>
        <span id="transportRound"></span>
        <span id="transportBase"></span>
        <span id="transportExpected"></span>
        <span id="transportRetries"></span>
      </div>

      <div class="transport-layout">
        <section class="lab-panel transport-diagram" aria-label="Reliable transport state">
          <div class="transport-endpoint"><strong>Sender</strong><small id="transportSenderCaption"></small></div>
          <div>
            <div class="transport-direction-label"><span>DATA →</span><span>← cumulative ACK</span></div>
            <div class="transport-lane" id="transportLane"></div>
            <div id="transportWindowLegend" class="transport-window-legend lab-note"></div>
          </div>
          <div class="transport-endpoint"><strong>Receiver</strong><small id="transportReceiverCaption"></small></div>
        </section>

        <section class="lab-panel">
          <strong>Application delivery</strong>
          <div id="transportDelivered" class="transport-delivered"></div>
          <p class="lab-note">Only in-order packets reach the application. Go-Back-N discards packets that arrive beyond a missing sequence number.</p>
        </section>
      </div>

      <section class="lab-panel transport-challenge">
        <strong>Predict the next network event</strong>
        <p class="lab-note">Before advancing, decide what the protocol will do next. This checks whether you understand the current sender/receiver state.</p>
        <div id="transportPredictionChoices" class="transport-prediction-choices"></div>
        <p id="transportPredictionFeedback" class="transport-prediction-feedback" aria-live="polite"></p>
      </section>

      <section class="lab-panel transport-explanation">
        <strong>Why did this happen?</strong>
        <p id="transportWhy" aria-live="polite"></p>
      </section>

      <section class="lab-panel" id="transportComparison" hidden>
        <strong>Same workload, different reliability strategy</strong>
        <div class="transport-compare-grid" id="transportCompareGrid"></div>
      </section>
    </div>`;

  const mode = host.querySelector<HTMLSelectElement>("#transportMode")!;
  const packets = host.querySelector<HTMLInputElement>("#transportPackets")!;
  const windowInput = host.querySelector<HTMLInputElement>("#transportWindow")!;
  const loss = host.querySelector<HTMLSelectElement>("#transportLoss")!;
  const speed = host.querySelector<HTMLSelectElement>("#transportSpeed")!;
  const timeline = host.querySelector<HTMLInputElement>("#transportTimeline")!;
  const play = host.querySelector<HTMLButtonElement>("#transportPlay")!;
  const comparisonPanel = host.querySelector<HTMLElement>("#transportComparison")!;
  const compareGrid = host.querySelector<HTMLElement>("#transportCompareGrid")!;
  const predictionChoices = host.querySelector<HTMLElement>("#transportPredictionChoices")!;
  const predictionFeedback = host.querySelector<HTMLElement>("#transportPredictionFeedback")!;
  let simulation: TransportSimulation = simulateReliableTransport("go-back-n", 6, 4, 2);
  let index = 0;
  let timer: number | null = null;

  SPEEDS.forEach((item, speedIndex) => {
    const option = document.createElement("option");
    option.value = String(item.delay);
    option.textContent = item.label;
    if (speedIndex === 1) option.selected = true;
    speed.append(option);
  });

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };

  const playbackDelay = () => Number(speed.value) || 650;

  const rebuildLossOptions = (preferred: string = loss.value) => {
    const normalizedPackets = normalizeTransportInput(Number(packets.value), Number(windowInput.value), null).packetCount;
    loss.replaceChildren();
    const noLoss = document.createElement("option");
    noLoss.value = "none";
    noLoss.textContent = "No loss";
    loss.append(noLoss);
    for (let sequence = 0; sequence < normalizedPackets; sequence++) {
      const option = document.createElement("option");
      option.value = String(sequence);
      option.textContent = `Packet ${sequence}`;
      loss.append(option);
    }
    loss.value = preferred === "none" || Number(preferred) < normalizedPackets ? preferred : "none";
    if (!loss.value) loss.value = "none";
  };

  const drawPacketStrip = (currentSequence: number | null, event: TransportEventKind) => {
    const snapshot = simulation.snapshots[index];
    const lane = host.querySelector<HTMLElement>("#transportLane")!;
    lane.replaceChildren();
    const windowEnd = Math.min(simulation.packetCount, snapshot.senderBase + simulation.windowSize);
    for (let sequence = 0; sequence < simulation.packetCount; sequence++) {
      const chip = document.createElement("span");
      chip.className = "transport-packet";
      chip.textContent = String(sequence);
      const delivered = snapshot.delivered.includes(sequence);
      if (delivered) chip.classList.add("delivered");
      else if (sequence >= snapshot.senderBase && sequence < windowEnd) chip.classList.add("in-window");
      else if (sequence >= windowEnd) chip.classList.add("future");
      if (currentSequence === sequence) chip.classList.add("active", `event-${event}`);
      const state = delivered ? "delivered" : sequence >= snapshot.senderBase && sequence < windowEnd ? "sender window" : "not yet in sender window";
      chip.setAttribute("aria-label", `Packet ${sequence}, ${state}${currentSequence === sequence ? `, current ${EVENT_LABELS[event]} event` : ""}`);
      lane.append(chip);
    }
    host.querySelector<HTMLElement>("#transportWindowLegend")!.textContent = simulation.mode === "go-back-n"
      ? `Outlined packets are currently eligible in the sender window [${snapshot.senderBase}–${Math.max(snapshot.senderBase, windowEnd - 1)}]. Green packets are already cumulatively delivered.`
      : `Stop-and-Wait exposes one packet at a time. Green packets are already cumulatively delivered.`;
  };

  const drawEventTrail = () => {
    const trail = host.querySelector<HTMLElement>("#transportEventTrail")!;
    trail.replaceChildren();
    simulation.snapshots.forEach((snapshot, stepIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `transport-event-pill event-${snapshot.event}${stepIndex === index ? " current" : ""}${stepIndex > index ? " future" : ""}`;
      button.textContent = snapshot.sequence === null ? EVENT_LABELS[snapshot.event] : `${EVENT_LABELS[snapshot.event]} ${snapshot.sequence}`;
      button.setAttribute("aria-label", `Step ${stepIndex + 1}: ${button.textContent}`);
      button.addEventListener("click", () => {
        stop();
        index = stepIndex;
        predictionFeedback.textContent = "";
        draw();
      });
      trail.append(button);
    });
    trail.querySelector<HTMLElement>(".current")?.scrollIntoView({ block: "nearest", inline: "center" });
  };

  const drawPrediction = () => {
    predictionChoices.replaceChildren();
    if (index >= simulation.snapshots.length - 1) {
      predictionFeedback.textContent = "Trace complete — rebuild or load another scenario to predict again.";
      return;
    }
    const next = simulation.snapshots[index + 1];
    const candidates: TransportEventKind[] = ["send", "deliver", "ack", "drop", "discard", "timeout"];
    const ordered = [next.event, ...candidates.filter(candidate => candidate !== next.event)].slice(0, 4);
    ordered.sort((a, b) => EVENT_LABELS[a].localeCompare(EVENT_LABELS[b]));
    ordered.forEach(candidate => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = EVENT_LABELS[candidate];
      button.addEventListener("click", () => {
        const correct = candidate === next.event;
        predictionFeedback.textContent = correct
          ? `Correct. Next is ${EVENT_LABELS[next.event]}${next.sequence === null ? "" : ` for packet ${next.sequence}`}. Now advance to see why.`
          : `Not quite. The next event is ${EVENT_LABELS[next.event]}${next.sequence === null ? "" : ` for packet ${next.sequence}`}. Review the sender base and receiver expectation, then advance.`;
        predictionFeedback.classList.toggle("correct", correct);
        predictionFeedback.classList.toggle("incorrect", !correct);
      });
      predictionChoices.append(button);
    });
  };

  const draw = () => {
    const snapshot = simulation.snapshots[index];
    drawPacketStrip(snapshot.sequence, snapshot.event);
    timeline.max = String(Math.max(0, simulation.snapshots.length - 1));
    timeline.value = String(index);
    host.querySelector<HTMLElement>("#transportTimelineLabel")!.textContent = `Step ${index + 1} of ${simulation.snapshots.length}: ${EVENT_LABELS[snapshot.event]}${snapshot.sequence === null ? "" : ` packet ${snapshot.sequence}`}`;
    host.querySelector<HTMLElement>("#transportStep")!.textContent = `Step ${index + 1}/${simulation.snapshots.length}`;
    host.querySelector<HTMLElement>("#transportRound")!.textContent = `Round ${snapshot.round}`;
    host.querySelector<HTMLElement>("#transportBase")!.textContent = `Sender base: ${snapshot.senderBase}`;
    host.querySelector<HTMLElement>("#transportExpected")!.textContent = `Receiver expects: ${snapshot.receiverExpected}`;
    host.querySelector<HTMLElement>("#transportRetries")!.textContent = `Retransmissions: ${snapshot.retransmissions}`;
    host.querySelector<HTMLElement>("#transportSenderCaption")!.textContent = simulation.mode === "go-back-n"
      ? `Window size ${simulation.windowSize}; base ${snapshot.senderBase}`
      : `One outstanding packet; base ${snapshot.senderBase}`;
    host.querySelector<HTMLElement>("#transportReceiverCaption")!.textContent = `Expects ${snapshot.receiverExpected}; cumulative ACK through ${snapshot.acknowledgedThrough}`;
    host.querySelector<HTMLElement>("#transportWhy")!.textContent = snapshot.explanation;

    const delivered = host.querySelector<HTMLElement>("#transportDelivered")!;
    delivered.replaceChildren();
    if (!snapshot.delivered.length) {
      const empty = document.createElement("span");
      empty.className = "lab-note";
      empty.textContent = "No packets delivered yet.";
      delivered.append(empty);
    } else {
      snapshot.delivered.forEach(sequence => {
        const chip = document.createElement("span");
        chip.className = "transport-app-packet";
        chip.textContent = String(sequence);
        delivered.append(chip);
      });
    }
    drawEventTrail();
    drawPrediction();
  };

  const rebuild = () => {
    stop();
    const selectedMode = mode.value as ReliabilityMode;
    const normalized = normalizeTransportInput(
      Number(packets.value),
      Number(windowInput.value),
      loss.value === "none" ? null : Number(loss.value)
    );
    packets.value = String(normalized.packetCount);
    windowInput.value = String(normalized.windowSize);
    windowInput.disabled = selectedMode === "stop-and-wait";
    rebuildLossOptions(normalized.lossSequence === null ? "none" : String(normalized.lossSequence));
    simulation = simulateReliableTransport(selectedMode, normalized.packetCount, normalized.windowSize, normalized.lossSequence);
    index = 0;
    comparisonPanel.hidden = true;
    predictionFeedback.textContent = "";
    predictionFeedback.className = "transport-prediction-feedback";
    draw();
  };

  const renderComparison = () => {
    stop();
    const normalized = normalizeTransportInput(
      Number(packets.value),
      Number(windowInput.value),
      loss.value === "none" ? null : Number(loss.value)
    );
    const comparison = compareReliableTransport(normalized.packetCount, normalized.windowSize, normalized.lossSequence);
    compareGrid.replaceChildren();
    const fewestRounds = Math.min(comparison.stopAndWait.rounds, comparison.goBackN.rounds);
    [comparison.stopAndWait, comparison.goBackN].forEach(result => {
      const card = document.createElement("article");
      card.className = `transport-compare-card${result.rounds === fewestRounds ? " best" : ""}`;
      const title = document.createElement("h4");
      title.textContent = result.mode === "stop-and-wait" ? "Stop-and-Wait" : "Go-Back-N";
      const stats = document.createElement("p");
      stats.textContent = `${result.rounds} rounds · ${result.transmissions} transmissions · ${result.retransmissions} retransmissions`;
      const note = document.createElement("p");
      note.className = "lab-note";
      note.textContent = result.mode === "stop-and-wait"
        ? "Simple and safe, but only one packet can make progress per round-trip."
        : "Keeps multiple packets in flight; a loss can cause several packets to be resent from the missing sequence onward.";
      card.append(title, stats, note);
      compareGrid.append(card);
    });
    comparisonPanel.hidden = false;
  };

  const loadPreset = (preset: string) => {
    if (preset === "clean") {
      mode.value = "go-back-n"; packets.value = "8"; windowInput.value = "4"; rebuildLossOptions("none"); loss.value = "none";
    } else if (preset === "early-loss") {
      mode.value = "go-back-n"; packets.value = "7"; windowInput.value = "4"; rebuildLossOptions("1"); loss.value = "1";
    } else if (preset === "stop-wait") {
      mode.value = "stop-and-wait"; packets.value = "5"; windowInput.value = "1"; rebuildLossOptions("2"); loss.value = "2";
    } else {
      mode.value = "go-back-n"; packets.value = "6"; windowInput.value = "4"; rebuildLossOptions("2"); loss.value = "2";
    }
    rebuild();
  };

  host.querySelector("#transportBuild")!.addEventListener("click", rebuild);
  host.querySelector("#transportPrev")!.addEventListener("click", () => { stop(); index = Math.max(0, index - 1); predictionFeedback.textContent = ""; draw(); });
  host.querySelector("#transportNext")!.addEventListener("click", () => { stop(); index = Math.min(simulation.snapshots.length - 1, index + 1); predictionFeedback.textContent = ""; draw(); });
  host.querySelector("#transportCompare")!.addEventListener("click", renderComparison);
  host.querySelectorAll<HTMLButtonElement>("[data-transport-preset]").forEach(button => button.addEventListener("click", () => loadPreset(button.dataset.transportPreset ?? "middle-loss")));
  timeline.addEventListener("input", () => { stop(); index = Math.max(0, Math.min(simulation.snapshots.length - 1, Number(timeline.value))); predictionFeedback.textContent = ""; draw(); });
  mode.addEventListener("change", rebuild);
  packets.addEventListener("change", () => { rebuildLossOptions(); rebuild(); });
  windowInput.addEventListener("change", rebuild);
  loss.addEventListener("change", rebuild);
  speed.addEventListener("change", () => {
    if (timer === null) return;
    stop();
    play.click();
  });
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    if (index >= simulation.snapshots.length - 1) index = 0;
    play.textContent = "Pause";
    draw();
    timer = window.setInterval(() => {
      if (index >= simulation.snapshots.length - 1) return stop();
      index++;
      predictionFeedback.textContent = "";
      draw();
    }, playbackDelay());
  });

  rebuildLossOptions("2");
  rebuild();
  return stop;
}

registerLabModule({
  id: "reliable-transport",
  icon: "⇆ACK",
  title: "Reliable Transport & Sliding Windows",
  description: "Predict and scrub through Stop-and-Wait and Go-Back-N sequence numbers, cumulative ACKs, loss, timeout, retransmission, and in-order delivery.",
  featured: true,
  render: renderReliableTransport
});
