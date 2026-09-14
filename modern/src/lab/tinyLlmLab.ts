import "./tinyLlmLab.css";
import { registerLabModule } from "./moduleRegistry";
import { attentionFor, attentionXRay, deterministicSample, embeddingFor, nextTokenDistribution, tokenizeTiny } from "./tinyLlmModel";

function formatVector(values: readonly number[]): string {
  return `[${values.map(value => value.toFixed(3)).join(", ")}]`;
}

function renderTinyLlm(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="lab-module tiny-llm-lab">
      <section class="llm-hero lab-panel">
        <div><span class="llm-kicker">AI · machine learning · transformers</span><h3>Build a tiny language model pipeline.</h3><p class="lab-note">This is a deliberately small, deterministic teaching model. It does not call an external AI service and it does not expose the hidden internals of ChatGPT; it teaches the same core ideas in a form you can inspect.</p></div>
        <div class="llm-flow">TEXT → TOKENS → EMBEDDINGS → ATTENTION → LOGITS → SOFTMAX → SAMPLE → REPEAT</div>
      </section>
      <section class="lab-panel">
        <div class="llm-controls"><label>Context<textarea data-llm-text maxlength="120" spellcheck="false">the robot needed power because it</textarea></label><button type="button" data-llm-reset>Reset example</button></div>
        <div><span class="llm-kicker">1 · Tokenization</span><div class="llm-token-row" data-llm-tokens></div></div>
      </section>
      <section class="llm-grid">
        <div class="lab-panel"><span class="llm-kicker">2 · Embeddings</span><p class="lab-note">Each token becomes a small vector. Real models use far more dimensions; this toy model uses three so the numbers stay readable.</p><div data-llm-embedding></div></div>
        <div class="lab-panel"><span class="llm-kicker">3 · Attention</span><p class="lab-note">Select a token. Its query is compared with every token's key-like embedding. Softmax converts those scores into attention weights.</p><div class="llm-attention-list" data-llm-attention></div></div>
      </section>
      <section class="lab-panel llm-xray-shell">
        <div class="llm-xray-heading"><div><span class="llm-kicker">X-Ray Mode · see the invisible state</span><strong>Open the attention calculation instead of trusting the animation.</strong></div><button type="button" data-llm-xray-toggle aria-pressed="false">Show X-Ray</button></div>
        <div data-llm-xray hidden>
          <div class="llm-xray-summary"><div><span>Focused token</span><strong data-llm-xray-token></strong></div><div><span>Query Q</span><code data-llm-xray-query></code></div><div><span>Scale √dₖ</span><strong data-llm-xray-scale></strong></div><div><span>Context vector Σ(weight × V)</span><code data-llm-xray-context></code></div></div>
          <div class="llm-predict"><label>Before revealing it, which token will receive the strongest attention?<select data-llm-predict></select></label><button type="button" data-llm-reveal>Reveal</button><span data-llm-feedback aria-live="polite"></span></div>
          <div class="llm-xray-table-wrap"><table class="llm-xray-table"><thead><tr><th>Token</th><th>Key / Value</th><th>Q · K</th><th>÷ √dₖ</th><th>Softmax</th><th>weight × V</th></tr></thead><tbody data-llm-xray-rows></tbody></table></div>
          <p class="lab-note">This toy uses each embedding as both the key and value so every stage is visible. Real transformers learn separate projection matrices for Q, K, and V.</p>
        </div>
      </section>
      <section class="lab-panel"><span class="llm-kicker">Transformer idea</span><div class="llm-stage-grid"><div class="llm-stage"><strong>Query</strong><span>What am I looking for?</span></div><div class="llm-stage"><strong>Keys</strong><span>What does each token offer?</span></div><div class="llm-stage"><strong>Dot product</strong><span>How well do they match?</span></div><div class="llm-stage"><strong>Scale</strong><span>Keep scores stable</span></div><div class="llm-stage"><strong>Softmax</strong><span>Turn scores into weights</span></div><div class="llm-stage"><strong>Values</strong><span>Blend useful information</span></div></div></section>
      <section class="llm-grid">
        <div class="lab-panel"><span class="llm-kicker">4 · Next-token logits</span><p class="lab-note">Logits are raw scores. They are not probabilities yet.</p><div class="llm-prob-list" data-llm-logits></div></div>
        <div class="lab-panel"><span class="llm-kicker">5 · Softmax + temperature</span><div class="llm-temperature"><span>Focused</span><input data-llm-temp type="range" min="0.2" max="2.5" step="0.1" value="1"><span data-llm-temp-label>1.0</span></div><div class="llm-prob-list" data-llm-probs></div></div>
      </section>
      <section class="lab-panel"><span class="llm-kicker">6 · Generate one token</span><div class="llm-generate"><button type="button" data-llm-generate>Generate One Token</button><button type="button" data-llm-clear>Clear generated</button><div class="llm-generated" data-llm-generated aria-live="polite"></div></div><p class="lab-note">Generation repeats the same cycle: append the sampled token, run the context through the model again, score the next token, sample again.</p></section>
      <section class="lab-panel llm-note"><strong>What this teaches</strong><p class="lab-note">LLMs are not databases that fetch a completed sentence. At inference time they repeatedly predict a probability distribution over the next token. Training is the separate process that adjusts billions of parameters so those distributions become useful.</p></section>
    </div>`;

  const controller = new AbortController();
  const { signal } = controller;
  const text = host.querySelector<HTMLTextAreaElement>("[data-llm-text]")!;
  const tokensHost = host.querySelector<HTMLElement>("[data-llm-tokens]")!;
  const embeddingHost = host.querySelector<HTMLElement>("[data-llm-embedding]")!;
  const attentionHost = host.querySelector<HTMLElement>("[data-llm-attention]")!;
  const logitsHost = host.querySelector<HTMLElement>("[data-llm-logits]")!;
  const probsHost = host.querySelector<HTMLElement>("[data-llm-probs]")!;
  const temp = host.querySelector<HTMLInputElement>("[data-llm-temp]")!;
  const tempLabel = host.querySelector<HTMLElement>("[data-llm-temp-label]")!;
  const generated = host.querySelector<HTMLElement>("[data-llm-generated]")!;
  const xrayToggle = host.querySelector<HTMLButtonElement>("[data-llm-xray-toggle]")!;
  const xrayPanel = host.querySelector<HTMLElement>("[data-llm-xray]")!;
  const predict = host.querySelector<HTMLSelectElement>("[data-llm-predict]")!;
  const feedback = host.querySelector<HTMLElement>("[data-llm-feedback]")!;
  const xrayRows = host.querySelector<HTMLTableSectionElement>("[data-llm-xray-rows]")!;
  let focusIndex = 0;
  let sampleCursor = 0.17;
  let xrayOpen = false;

  const draw = () => {
    const tokens = tokenizeTiny(text.value);
    focusIndex = Math.max(0, Math.min(Math.max(0, tokens.length - 1), focusIndex));
    tokensHost.replaceChildren();
    tokens.forEach((token, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `llm-token${index === focusIndex ? " active" : ""}`;
      button.textContent = token;
      button.onclick = () => { focusIndex = index; feedback.textContent = ""; draw(); };
      tokensHost.append(button);
    });

    embeddingHost.replaceChildren();
    if (tokens.length) {
      const token = tokens[focusIndex];
      const vector = embeddingFor(token);
      const p = document.createElement("p");
      p.textContent = `Token “${token}” → ${formatVector(vector)}`;
      embeddingHost.append(p);
    }

    attentionHost.replaceChildren();
    const attention = attentionFor(text.value, focusIndex);
    attention.tokens.forEach((token, index) => {
      const row = document.createElement("div"); row.className = "llm-att-row";
      const label = document.createElement("span"); label.textContent = token;
      const track = document.createElement("div"); track.className = "llm-bar-track";
      const bar = document.createElement("div"); bar.className = "llm-bar"; bar.style.width = `${attention.weights[index] * 100}%`; track.append(bar);
      const value = document.createElement("strong"); value.textContent = `${(attention.weights[index] * 100).toFixed(1)}%`;
      row.append(label, track, value); attentionHost.append(row);
    });

    const xray = attentionXRay(text.value, focusIndex);
    host.querySelector<HTMLElement>("[data-llm-xray-token]")!.textContent = xray ? `“${xray.focusToken}”` : "—";
    host.querySelector<HTMLElement>("[data-llm-xray-query]")!.textContent = xray ? formatVector(xray.query) : "—";
    host.querySelector<HTMLElement>("[data-llm-xray-scale]")!.textContent = xray ? xray.scale.toFixed(3) : "—";
    host.querySelector<HTMLElement>("[data-llm-xray-context]")!.textContent = xray ? formatVector(xray.contextVector) : "—";
    xrayRows.replaceChildren();
    predict.replaceChildren();
    if (xray) {
      xray.rows.forEach((row, index) => {
        const option = document.createElement("option"); option.value = String(index); option.textContent = row.token; predict.append(option);
        const tr = document.createElement("tr");
        if (index === xray.strongestIndex) tr.className = "llm-xray-strongest";
        const values = [row.token, formatVector(row.key), row.rawDot.toFixed(3), row.scaledScore.toFixed(3), `${(row.weight * 100).toFixed(1)}%`, formatVector(row.contribution)];
        values.forEach((value, column) => { const cell = document.createElement(column === 0 ? "th" : "td"); cell.textContent = value; tr.append(cell); });
        xrayRows.append(tr);
      });
    }

    const distribution = nextTokenDistribution(text.value, Number(temp.value));
    tempLabel.textContent = Number(temp.value).toFixed(1);
    logitsHost.replaceChildren(); probsHost.replaceChildren();
    distribution.forEach(candidate => {
      const logitRow = document.createElement("div"); logitRow.className = "llm-prob-row";
      const l1 = document.createElement("span"); l1.textContent = candidate.token;
      const l2 = document.createElement("div"); l2.className = "llm-bar-track";
      const lbar = document.createElement("div"); lbar.className = "llm-bar"; lbar.style.width = `${Math.max(4, Math.min(100, candidate.logit * 24))}%`; l2.append(lbar);
      const l3 = document.createElement("strong"); l3.textContent = candidate.logit.toFixed(2); logitRow.append(l1,l2,l3); logitsHost.append(logitRow);
      const probRow = document.createElement("div"); probRow.className = "llm-prob-row";
      const p1 = document.createElement("span"); p1.textContent = candidate.token;
      const p2 = document.createElement("div"); p2.className = "llm-bar-track";
      const pbar = document.createElement("div"); pbar.className = "llm-bar"; pbar.style.width = `${candidate.probability * 100}%`; p2.append(pbar);
      const p3 = document.createElement("strong"); p3.textContent = `${(candidate.probability * 100).toFixed(1)}%`; probRow.append(p1,p2,p3); probsHost.append(probRow);
    });
  };

  text.addEventListener("input", () => { focusIndex = Math.max(0, tokenizeTiny(text.value).length - 1); feedback.textContent = ""; draw(); }, { signal });
  temp.addEventListener("input", draw, { signal });
  xrayToggle.addEventListener("click", () => { xrayOpen = !xrayOpen; xrayPanel.hidden = !xrayOpen; xrayToggle.setAttribute("aria-pressed", String(xrayOpen)); xrayToggle.textContent = xrayOpen ? "Hide X-Ray" : "Show X-Ray"; }, { signal });
  host.querySelector<HTMLButtonElement>("[data-llm-reveal]")!.addEventListener("click", () => {
    const xray = attentionXRay(text.value, focusIndex);
    if (!xray) { feedback.textContent = "Add at least one token first."; return; }
    const guess = Number(predict.value);
    const winner = xray.rows[xray.strongestIndex].token;
    feedback.textContent = guess === xray.strongestIndex ? `Correct — “${winner}” has the largest scaled match, so softmax gives it the most weight.` : `Not this time. “${winner}” receives the most weight. Compare the Q · K and scaled-score columns.`;
  }, { signal });
  host.querySelector<HTMLButtonElement>("[data-llm-reset]")!.addEventListener("click", () => { text.value = "the robot needed power because it"; focusIndex = 5; generated.textContent = ""; feedback.textContent = ""; draw(); }, { signal });
  host.querySelector<HTMLButtonElement>("[data-llm-clear]")!.addEventListener("click", () => { generated.textContent = ""; }, { signal });
  host.querySelector<HTMLButtonElement>("[data-llm-generate]")!.addEventListener("click", () => {
    const candidates = nextTokenDistribution(text.value, Number(temp.value));
    const token = deterministicSample(candidates, sampleCursor);
    sampleCursor = (sampleCursor + 0.37) % 1;
    text.value = `${text.value.trim()} ${token}`.slice(0, 120);
    generated.textContent = `Sampled “${token}”. New context: ${text.value}`;
    focusIndex = Math.max(0, tokenizeTiny(text.value).length - 1); feedback.textContent = ""; draw();
  }, { signal });
  focusIndex = Math.max(0, tokenizeTiny(text.value).length - 1); draw();
  return () => controller.abort();
}

registerLabModule({ id: "tiny-llm", icon: "🧠", title: "Tiny LLM + Attention", description: "Inspect tokenization, embeddings, attention, logits, softmax, temperature, and next-token generation in a deterministic toy transformer pipeline.", featured: true, render: renderTinyLlm });
