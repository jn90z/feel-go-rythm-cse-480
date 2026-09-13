import "./dataSecurityLabs.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import {
  encryptionHandshakeStages,
  encryptionVisibility,
  runLengthEncode,
  vpnTunnelStages,
  vpnVisibility,
  zipPipelineStages,
  type SecurityStage,
  type VisibilityRow
} from "./dataSecurityModels";

function renderStageTimeline(container: HTMLElement, stages: SecurityStage[], index: number): void {
  container.replaceChildren();
  stages.forEach((stage, stageIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "data-stage-dot";
    if (stageIndex < index) button.classList.add("done");
    if (stageIndex === index) button.classList.add("current");
    button.dataset.stageIndex = String(stageIndex);
    button.textContent = String(stageIndex + 1);
    button.setAttribute("aria-label", `Step ${stageIndex + 1}: ${stage.title}`);
    container.append(button);
  });
}

function renderVisibility(container: HTMLElement, rows: VisibilityRow[]): void {
  container.replaceChildren();
  rows.forEach(row => {
    const card = document.createElement("article");
    card.className = "visibility-card";
    const heading = document.createElement("strong");
    heading.textContent = row.observer;
    const can = document.createElement("p");
    can.textContent = `Can see: ${row.canSee}`;
    const cannot = document.createElement("p");
    cannot.className = "lab-note";
    cannot.textContent = `Cannot see: ${row.cannotSee}`;
    card.append(heading, can, cannot);
    container.append(card);
  });
}

function bindTraceControls(
  host: HTMLElement,
  stages: SecurityStage[],
  draw: (index: number) => void,
  selectorPrefix: string,
  intervalMs = 900
): LabModuleCleanup {
  let index = 0;
  let timer: number | null = null;
  const play = host.querySelector<HTMLButtonElement>(`[data-${selectorPrefix}-play]`)!;
  const speed = host.querySelector<HTMLSelectElement>(`[data-${selectorPrefix}-speed]`);

  const stop = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = "Play";
  };
  const redraw = () => draw(index);
  const start = () => {
    stop();
    if (index >= stages.length - 1) index = 0;
    play.textContent = "Pause";
    const factor = Number(speed?.value ?? 1);
    timer = window.setInterval(() => {
      if (index >= stages.length - 1) return stop();
      index += 1;
      redraw();
    }, Math.max(180, intervalMs / Math.max(.25, factor)));
  };

  host.querySelector(`[data-${selectorPrefix}-prev]`)!.addEventListener("click", () => {
    stop(); index = Math.max(0, index - 1); redraw();
  });
  host.querySelector(`[data-${selectorPrefix}-next]`)!.addEventListener("click", () => {
    stop(); index = Math.min(stages.length - 1, index + 1); redraw();
  });
  play.addEventListener("click", () => timer === null ? start() : stop());
  speed?.addEventListener("change", () => { if (timer !== null) start(); });
  host.addEventListener("click", event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-stage-index]");
    if (!target) return;
    stop();
    index = Math.max(0, Math.min(stages.length - 1, Number(target.dataset.stageIndex)));
    redraw();
  });
  redraw();
  return stop;
}

function renderCompression(host: HTMLElement): LabModuleCleanup {
  const stages = zipPipelineStages();
  host.innerHTML = `
    <div class="lab-module data-security-lab">
      <section class="lab-panel data-hero">
        <div><strong>Compression & .ZIP</strong><p class="lab-note">See redundancy collapse in a reversible toy compressor, then step through what a real ZIP/DEFLATE archive does.</p></div>
        <div class="data-badge">Lossless ≠ encrypted</div>
      </section>
      <div class="lab-controls">
        <label>Sample<select data-compress-preset><option value="runs">Repeated runs</option><option value="sentence">Sentence</option><option value="mixed">Mixed data</option></select></label>
        <label class="data-wide-control">Text<input data-compress-input maxlength="160" value="AAAAAAAABBBBBCCCCCCCCCCDDDAAAAAAAA" /></label>
        <button type="button" data-compress-run>Compress</button>
      </div>
      <section class="compression-compare">
        <div class="lab-panel"><strong>Original</strong><div class="byte-stream" data-compress-original></div><p class="lab-note" data-compress-original-meta></p></div>
        <div class="compression-arrow" aria-hidden="true">→</div>
        <div class="lab-panel"><strong>Toy RLE encoding</strong><div class="token-stream" data-compress-tokens></div><p class="lab-note" data-compress-encoded-meta></p></div>
      </section>
      <section class="lab-panel">
        <strong>Why this is only a toy compressor</strong>
        <p class="lab-note">Run-length encoding makes repeated symbols easy to see, but normal ZIP files commonly use DEFLATE, which combines LZ77-style back-references with Huffman coding. The ZIP format is also a container with file metadata and checksums.</p>
      </section>
      <section class="lab-panel">
        <div class="data-trace-heading"><strong>What happens when you create a .zip?</strong><div><button type="button" data-zip-prev>Previous</button><button type="button" data-zip-play>Play</button><button type="button" data-zip-next>Next</button><select data-zip-speed aria-label="Playback speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></div></div>
        <div class="data-stage-timeline" data-zip-timeline></div>
        <article class="data-stage-card" data-zip-stage></article>
      </section>
      <section class="lab-panel misconception"><strong>Key idea</strong><p class="lab-note">Compression removes redundancy. Encryption hides meaning. A ZIP file may be compressed without being encrypted, and encrypted data often compresses poorly because good ciphertext intentionally looks patternless.</p></section>
    </div>`;

  const input = host.querySelector<HTMLInputElement>("[data-compress-input]")!;
  const preset = host.querySelector<HTMLSelectElement>("[data-compress-preset]")!;
  const original = host.querySelector<HTMLElement>("[data-compress-original]")!;
  const tokens = host.querySelector<HTMLElement>("[data-compress-tokens]")!;
  const originalMeta = host.querySelector<HTMLElement>("[data-compress-original-meta]")!;
  const encodedMeta = host.querySelector<HTMLElement>("[data-compress-encoded-meta]")!;
  const presets: Record<string, string> = {
    runs: "AAAAAAAABBBBBCCCCCCCCCCDDDAAAAAAAA",
    sentence: "the rain in Spain falls mainly in the plain",
    mixed: "ABC123ABC123ABC123---ZZZZZZZZ"
  };

  const run = () => {
    const result = runLengthEncode(input.value);
    input.value = result.input;
    original.replaceChildren(...[...result.input].map(symbol => {
      const cell = document.createElement("span"); cell.textContent = symbol === " " ? "␠" : symbol; return cell;
    }));
    tokens.replaceChildren(...result.tokens.map(token => {
      const chip = document.createElement("span"); chip.textContent = `${token.count} × ${token.symbol === " " ? "space" : token.symbol}`; return chip;
    }));
    originalMeta.textContent = `${result.inputBytes} UTF-8 bytes in this input.`;
    const direction = result.encodedBytes < result.inputBytes ? "smaller" : result.encodedBytes > result.inputBytes ? "larger" : "the same size";
    encodedMeta.textContent = `${result.encodedBytes} bytes in this deliberately readable RLE representation — ${direction}. Round-trip ${result.reversible ? "verified" : "failed"}. Real compressors use compact binary codes instead of this teaching notation.`;
  };
  preset.addEventListener("change", () => { input.value = presets[preset.value] ?? presets.runs; run(); });
  host.querySelector("[data-compress-run]")!.addEventListener("click", run);
  run();

  return bindTraceControls(host, stages, index => {
    const timeline = host.querySelector<HTMLElement>("[data-zip-timeline]")!;
    const card = host.querySelector<HTMLElement>("[data-zip-stage]")!;
    renderStageTimeline(timeline, stages, index);
    const stage = stages[index];
    card.replaceChildren();
    const step = document.createElement("small"); step.textContent = `STEP ${index + 1} OF ${stages.length}`;
    const title = document.createElement("h3"); title.textContent = stage.title;
    const detail = document.createElement("p"); detail.textContent = stage.detail;
    card.className = `data-stage-card kind-${stage.kind}`;
    card.append(step, title, detail);
  }, "zip", 1050);
}

function renderEncryption(host: HTMLElement): LabModuleCleanup {
  const stages = encryptionHandshakeStages();
  host.innerHTML = `
    <div class="lab-module data-security-lab">
      <section class="lab-panel data-hero"><div><strong>Encryption, Decryption & Keys</strong><p class="lab-note">Follow a modern TLS-style connection from identity verification to shared symmetric session encryption.</p></div><div class="data-badge">Public-key + symmetric crypto</div></section>
      <div class="lab-controls"><button type="button" data-crypto-prev>Previous</button><button type="button" data-crypto-play>Play</button><button type="button" data-crypto-next>Next</button><label>Speed<select data-crypto-speed><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
      <div class="data-stage-timeline" data-crypto-timeline></div>
      <section class="crypto-scene lab-panel">
        <div class="crypto-party"><span class="device-icon">💻</span><strong>Client</strong><div class="key-chip secret">private ephemeral value</div></div>
        <div class="crypto-network"><div class="crypto-flow" data-crypto-flow>public certificate →</div><div class="crypto-lock">🔒</div></div>
        <div class="crypto-party"><span class="device-icon">🖥️</span><strong>Server</strong><div class="key-chip secret">private key stays here</div></div>
      </section>
      <section class="lab-panel data-stage-card" data-crypto-stage></section>
      <section class="lab-panel"><strong>Who can see what?</strong><div class="visibility-grid" data-crypto-visibility></div></section>
      <section class="lab-panel prediction-panel"><strong>Quick check: which item must never be sent to strangers?</strong><div class="prediction-buttons"><button type="button" data-key-answer="public">Public key</button><button type="button" data-key-answer="certificate">Certificate</button><button type="button" data-key-answer="private">Private key</button></div><p class="lab-note" data-key-feedback>Make a prediction.</p></section>
      <section class="lab-panel misconception"><strong>Important distinction</strong><p class="lab-note">Modern TLS does not normally use public-key encryption for every application packet. Public-key techniques authenticate identities and establish/derive shared secrets; efficient symmetric authenticated encryption protects the bulk data.</p></section>
    </div>`;
  renderVisibility(host.querySelector<HTMLElement>("[data-crypto-visibility]")!, encryptionVisibility());
  const feedback = host.querySelector<HTMLElement>("[data-key-feedback]")!;
  host.querySelectorAll<HTMLButtonElement>("[data-key-answer]").forEach(button => button.addEventListener("click", () => {
    const correct = button.dataset.keyAnswer === "private";
    feedback.textContent = correct
      ? "Correct. A private key/private ephemeral value must remain secret; public keys and certificates are designed to be shared."
      : "That item is designed to be shareable. The private key is the one that must remain secret.";
  }));

  return bindTraceControls(host, stages, index => {
    renderStageTimeline(host.querySelector<HTMLElement>("[data-crypto-timeline]")!, stages, index);
    const stage = stages[index];
    const card = host.querySelector<HTMLElement>("[data-crypto-stage]")!;
    card.replaceChildren();
    const title = document.createElement("h3"); title.textContent = `${index + 1}. ${stage.title}`;
    const detail = document.createElement("p"); detail.textContent = stage.detail;
    card.className = `lab-panel data-stage-card kind-${stage.kind}`;
    card.append(title, detail);
    const flow = host.querySelector<HTMLElement>("[data-crypto-flow]")!;
    flow.textContent = index < 2 ? "certificate + public info →" : index < 4 ? "← public key-agreement values →" : "← encrypted application data →";
  }, "crypto", 1100);
}

function renderVpn(host: HTMLElement): LabModuleCleanup {
  const stages = vpnTunnelStages();
  host.innerHTML = `
    <div class="lab-module data-security-lab">
      <section class="lab-panel data-hero"><div><strong>VPN & Network Tunneling</strong><p class="lab-note">Watch an ordinary IP packet become an encrypted inner packet carried inside a routable outer packet.</p></div><div class="data-badge">Tunnel ≠ invisibility cloak</div></section>
      <div class="lab-controls"><button type="button" data-vpn-prev>Previous</button><button type="button" data-vpn-play>Play</button><button type="button" data-vpn-next>Next</button><label>Speed<select data-vpn-speed><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
      <div class="data-stage-timeline" data-vpn-timeline></div>
      <section class="vpn-route lab-panel">
        <div class="vpn-node"><span>💻</span><strong>Your device</strong></div><div class="route-line"><span data-vpn-hop-one>encrypted tunnel</span></div><div class="vpn-node gateway"><span>🛡️</span><strong>VPN gateway</strong></div><div class="route-line"><span data-vpn-hop-two>forwarded traffic</span></div><div class="vpn-node"><span>🌐</span><strong>Destination</strong></div>
      </section>
      <section class="packet-stack lab-panel">
        <strong>Packet layers at this step</strong>
        <div class="packet-layer outer"><small>OUTER IP HEADER</small><span data-vpn-outer>Your IP → VPN gateway IP</span></div>
        <div class="packet-layer protected"><small>ENCRYPTED / AUTHENTICATED TUNNEL PAYLOAD</small><span data-vpn-protected>Inner packet hidden here</span></div>
        <div class="packet-layer inner"><small>INNER PACKET</small><span data-vpn-inner>Your app → destination</span></div>
      </section>
      <section class="lab-panel data-stage-card" data-vpn-stage></section>
      <section class="lab-panel"><strong>Who can see what?</strong><div class="visibility-grid" data-vpn-visibility></div></section>
      <section class="lab-panel misconception"><strong>VPN + HTTPS together</strong><p class="lab-note">A VPN changes which network sees your destination traffic directly, but the VPN provider becomes a trust point. HTTPS/TLS can still provide end-to-end application encryption through the VPN, so the VPN provider can route that traffic without automatically seeing the protected web plaintext.</p></section>
    </div>`;
  renderVisibility(host.querySelector<HTMLElement>("[data-vpn-visibility]")!, vpnVisibility());

  return bindTraceControls(host, stages, index => {
    renderStageTimeline(host.querySelector<HTMLElement>("[data-vpn-timeline]")!, stages, index);
    const stage = stages[index];
    const card = host.querySelector<HTMLElement>("[data-vpn-stage]")!;
    card.replaceChildren();
    const title = document.createElement("h3"); title.textContent = `${index + 1}. ${stage.title}`;
    const detail = document.createElement("p"); detail.textContent = stage.detail;
    card.className = `lab-panel data-stage-card kind-${stage.kind}`;
    card.append(title, detail);

    const protectedLayer = host.querySelector<HTMLElement>(".packet-layer.protected")!;
    const innerLayer = host.querySelector<HTMLElement>(".packet-layer.inner")!;
    const outerLayer = host.querySelector<HTMLElement>(".packet-layer.outer")!;
    protectedLayer.classList.toggle("active", index >= 1 && index <= 3 || index === 6);
    outerLayer.classList.toggle("active", index >= 2 && index <= 3 || index === 6);
    innerLayer.classList.toggle("active", index === 0 || index === 4 || index === 5);
    host.querySelector<HTMLElement>("[data-vpn-hop-one]")!.textContent = index >= 1 && index <= 3 ? "🔒 encrypted tunnel" : index >= 4 ? "tunnel endpoint" : "inner packet prepared";
    host.querySelector<HTMLElement>("[data-vpn-hop-two]")!.textContent = index >= 5 ? "→ forwarded to destination" : "destination side";
  }, "vpn", 1050);
}

registerLabModule({
  id: "compression-zip",
  icon: "ZIP",
  title: "Compression & ZIP",
  description: "Compress and decompress data, visualize redundancy, and step through how ZIP/DEFLATE stores files losslessly.",
  featured: true,
  render: renderCompression
});

registerLabModule({
  id: "encryption-keys",
  icon: "🔐",
  title: "Encryption & Public/Private Keys",
  description: "Visualize certificates, public/private keys, key agreement, session keys, encryption, decryption, and network visibility.",
  featured: true,
  render: renderEncryption
});

registerLabModule({
  id: "vpn-tunneling",
  icon: "🛡️",
  title: "VPN & Network Tunneling",
  description: "Follow inner packets through encrypted VPN tunnels and see what ISPs, VPN gateways, and destinations can observe.",
  featured: true,
  render: renderVpn
});
