import "./reliableTransportLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import {
  compareReliableTransport,
  normalizeTransportInput,
  simulateReliableTransport,
  type ReliabilityMode,
  type TransportSimulation
} from "./reliableTransportModel";

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
          <select id="transportLoss">
            <option value="none">No loss</option>
          </select>
        </label>
        <button id="transportBuild" type="button">Build Trace</button>
        <button id="transportPrev" type="button">Previous</button>
        <button id="transportPlay" type="button">Play</button>
        <button id="transportNext" type="button">Next</button>
        <button id="transportCompare" type="button">Compare Protocols</button>
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
          <div class="transport-lane" id="transportLane"></div>
          <div class="transport-endpoint"><strong>Receiver</strong><small id="transportReceiverCaption"></small></div>
        </section>

        <section class="lab-panel">
          <strong>Application delivery</strong>
          <div id="transportDelivered" class="transport-delivered"></div>
          <p class="lab-note">Only in-order packets reach the application. Go-Back-N discards packets that arrive beyond a missing sequence number.</p>
        </section>
      </div>

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
  const play = host.querySelector<HTMLButtonElement>("#transportPlay")!;
  const comparisonPanel = host.querySelector<HTMLElement>("#transportComparison")!;
  const compareGrid = host.querySelector<HTMLElement>("#transportCompareGrid")!;
  let simulation: TransportSimulation = simulateReliableTransport("go-back-n", 6, 4, 2);
  let index = 0;
  let timer: number | null = null;

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };

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

  const drawPacketStrip = (currentSequence: number | null, event: string) => {
    const lane = host.querySelector<HTMLElement>("#transportLane")!;
    lane.replaceChildren();
    for (let sequence = 0; sequence < simulation.packetCount; sequence++) {
      const chip = document.createElement("span");
      chip.className = "transport-packet";
      chip.textContent = String(sequence);
      if (simulation.snapshots[index].delivered.includes(sequence)) chip.classList.add("delivered");
      if (currentSequence === sequence) chip.classList.add("active", `event-${event}`);
      lane.append(chip);
    }
  };

  const draw = () => {
    const snapshot = simulation.snapshots[index];
    drawPacketStrip(snapshot.sequence, snapshot.event);
    host.querySelector<HTMLElement>("#transportStep")!.textContent = `Step ${index + 1}/${simulation.snapshots.length}`;
    host.querySelector<HTMLElement>("#transportRound")!.textContent = `Round ${snapshot.round}`;
    host.querySelector<HTMLElement>("#transportBase")!.textContent = `Sender base: ${snapshot.senderBase}`;
    host.querySelector<HTMLElement>("#transportExpected")!.textContent = `Receiver expects: ${snapshot.receiverExpected}`;
    host.querySelector<HTMLElement>("#transportRetries")!.textContent = `Retransmissions: ${snapshot.retransmissions}`;
    host.querySelector<HTMLElement>("#transportSenderCaption")!.textContent = simulation.mode === "go-back-n"
      ? `Window size ${simulation.windowSize}`
      : "One outstanding packet";
    host.querySelector<HTMLElement>("#transportReceiverCaption")!.textContent = `Cumulative ACK through ${snapshot.acknowledgedThrough}`;
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
    [comparison.stopAndWait, comparison.goBackN].forEach(result => {
      const card = document.createElement("article");
      card.className = "transport-compare-card";
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

  host.querySelector("#transportBuild")!.addEventListener("click", rebuild);
  host.querySelector("#transportPrev")!.addEventListener("click", () => {
    stop();
    index = Math.max(0, index - 1);
    draw();
  });
  host.querySelector("#transportNext")!.addEventListener("click", () => {
    stop();
    index = Math.min(simulation.snapshots.length - 1, index + 1);
    draw();
  });
  host.querySelector("#transportCompare")!.addEventListener("click", renderComparison);
  mode.addEventListener("change", rebuild);
  packets.addEventListener("change", () => {
    rebuildLossOptions();
    rebuild();
  });
  windowInput.addEventListener("change", rebuild);
  loss.addEventListener("change", rebuild);
  play.addEventListener("click", () => {
    if (timer !== null) return stop();
    if (index >= simulation.snapshots.length - 1) index = 0;
    play.textContent = "Pause";
    draw();
    timer = window.setInterval(() => {
      if (index >= simulation.snapshots.length - 1) return stop();
      index++;
      draw();
    }, 650);
  });

  rebuildLossOptions("2");
  rebuild();
  return stop;
}

registerLabModule({
  id: "reliable-transport",
  icon: "⇆ACK",
  title: "Reliable Transport & Sliding Windows",
  description: "Compare Stop-and-Wait with Go-Back-N. Step through sequence numbers, cumulative ACKs, loss, timeouts, retransmission, and in-order delivery.",
  featured: true,
  render: renderReliableTransport
});
