import "./numberSystemsLab.css";
import { registerLabModule } from "./moduleRegistry";
import { addFixedWidth, parseInBase, positionalTerms, snapshot, toggleBit, type BitWidth } from "./numberSystemsModel";

function esc(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function renderNumberSystems(host: HTMLElement): void {
  host.innerHTML = `<div class="lab-module number-lab">
    <div class="lab-panel"><h3>Number Systems & Bits X-Ray</h3><p>Change the bits or type a number. The bit pattern stays physical; decimal, hex, and signed/unsigned are different ways humans interpret it.</p></div>
    <div class="lab-panel number-controls">
      <label>Input base<select id="numBase"><option value="10">Decimal</option><option value="2">Binary</option><option value="16">Hexadecimal</option><option value="8">Octal</option></select></label>
      <label>Value<input id="numInput" value="182" inputmode="text" autocomplete="off" spellcheck="false"></label>
      <label>Register width<select id="numWidth"><option value="8">8 bit</option><option value="16">16 bit</option><option value="32">32 bit</option></select></label>
      <button id="numApply" type="button">Load value</button><button id="numZero" type="button">Clear bits</button>
    </div>
    <div id="numError" class="lab-note" role="status"></div>
    <div class="lab-panel"><strong>Tap bits on and off</strong><p class="lab-note">The leftmost bit is the most significant bit. In a signed two's-complement interpretation it is also the sign bit.</p><div id="bitRegister" class="bit-register"></div></div>
    <div id="numberReadouts" class="number-readouts"></div>
    <div class="lab-panel"><strong>Why this binary number has its value</strong><div id="positionExplain" class="number-explain"></div></div>
    <div class="lab-panel"><strong>Binary ↔ hex: four bits at a time</strong><p class="lab-note">One hexadecimal digit represents exactly four binary bits, which is why hex is convenient for registers, addresses, masks, and machine data.</p><div id="hexGroups" class="hex-groups"></div></div>
    <div class="lab-panel"><strong>Signed vs. unsigned</strong><div id="signedExplain"></div></div>
    <div class="lab-panel overflow-demo"><strong>Fixed-width addition & overflow</strong><div class="number-controls"><label>A<input id="addA" type="number" value="127"></label><label>B<input id="addB" type="number" value="1"></label><button id="addRun" type="button">Add in this register</button></div><div id="overflowResult"></div><div><button id="demoUnsigned" type="button">Demo 255 + 1</button> <button id="demoSigned" type="button">Demo 127 + 1</button></div></div>
    <div class="lab-panel"><strong>Predict before reveal</strong><p id="challengeQuestion">If 11111111 is an 8-bit pattern, what changes when we switch from unsigned to signed?</p><button id="challengeReveal" type="button">Reveal explanation</button><div id="challengeAnswer" class="challenge-answer"></div></div>
  </div>`;

  const widthEl = host.querySelector<HTMLSelectElement>("#numWidth")!;
  const baseEl = host.querySelector<HTMLSelectElement>("#numBase")!;
  const inputEl = host.querySelector<HTMLInputElement>("#numInput")!;
  const errorEl = host.querySelector<HTMLElement>("#numError")!;
  let width: BitWidth = 8;
  let raw = 182;

  const draw = () => {
    const s = snapshot(raw, width);
    raw = s.raw;
    const bits = host.querySelector<HTMLElement>("#bitRegister")!;
    bits.replaceChildren();
    [...s.binary].forEach((bit, index) => {
      const power = width - 1 - index;
      const column = document.createElement("div"); column.className = "bit-column";
      const label = document.createElement("small"); label.textContent = `2^${power}`;
      const button = document.createElement("button"); button.type = "button"; button.className = `bit-button ${bit === "1" ? "on" : ""} ${power === width - 1 ? "sign" : ""}`; button.textContent = bit; button.title = `Bit ${power}: value ${2 ** power}`;
      button.addEventListener("click", () => { raw = toggleBit(raw, width, power); draw(); });
      column.append(label, button); bits.append(column);
    });
    host.querySelector<HTMLElement>("#numberReadouts")!.innerHTML = `
      <div class="number-readout"><strong>Binary</strong><code>${s.binary.replace(/(.{4})(?=.)/g, "$1 ")}</code></div>
      <div class="number-readout"><strong>Hexadecimal</strong><code>0x${s.hex}</code></div>
      <div class="number-readout"><strong>Decimal · unsigned</strong><code>${s.unsigned}</code></div>
      <div class="number-readout"><strong>Decimal · signed</strong><code>${s.signed}</code></div>
      <div class="number-readout"><strong>Octal</strong><code>0o${s.octal}</code></div>`;
    const terms = positionalTerms(raw, width);
    host.querySelector<HTMLElement>("#positionExplain")!.textContent = terms.length
      ? `${terms.map(t => `1×2^${t.power} (${t.value})`).join(" + ")} = ${s.unsigned}`
      : "All bits are 0, so every positional contribution is 0.";
    const groups = s.binary.match(/.{4}/g) ?? [];
    host.querySelector<HTMLElement>("#hexGroups")!.innerHTML = groups.map((group, i) => `<div class="hex-group">${group}<br>↓<br>${s.hex[i]}</div>`).join("");
    const signSet = s.binary[0] === "1";
    host.querySelector<HTMLElement>("#signedExplain")!.innerHTML = `<p class="callout">The stored ${width}-bit pattern is <code>${s.binary}</code>. Nothing in these bits says “signed” or “unsigned.” The interpretation supplies that rule.</p><p>Unsigned reads every bit as magnitude, giving <strong>${s.unsigned}</strong>. Signed two's complement ${signSet ? `sees the top bit set. Subtract 2^${width} (${2 ** width}) from ${s.unsigned}, giving <strong>${s.signed}</strong>.` : `sees the top bit clear, so the signed value is also <strong>${s.signed}</strong>.`}</p>`;
  };

  const loadInput = () => {
    const parsed = parseInBase(inputEl.value, Number(baseEl.value));
    if (parsed === null) { errorEl.textContent = `That is not a valid base-${baseEl.value} integer.`; return; }
    errorEl.textContent = ""; raw = parsed; draw();
  };
  host.querySelector("#numApply")!.addEventListener("click", loadInput);
  inputEl.addEventListener("keydown", e => { if (e.key === "Enter") loadInput(); });
  host.querySelector("#numZero")!.addEventListener("click", () => { raw = 0; inputEl.value = "0"; draw(); });
  widthEl.addEventListener("change", () => { width = Number(widthEl.value) as BitWidth; draw(); });

  const runAddition = () => {
    const a = Number((host.querySelector<HTMLInputElement>("#addA")!).value) || 0;
    const b = Number((host.querySelector<HTMLInputElement>("#addB")!).value) || 0;
    const r = addFixedWidth(a, b, width); const sa = snapshot(r.a, width), sb = snapshot(r.b, width), sr = snapshot(r.result, width);
    host.querySelector<HTMLElement>("#overflowResult")!.innerHTML = `<div class="number-explain">${sa.binary}<br>+ ${sb.binary}<br>= ${sr.binary}</div><p>Unsigned: ${r.a} + ${r.b} → <strong>${r.result}</strong>. Carry out: <strong>${r.carry ? "yes" : "no"}</strong>.</p><p>Signed: ${r.signedA} + ${r.signedB} → <strong>${r.signedResult}</strong>. Signed overflow: <strong>${r.signedOverflow ? "yes" : "no"}</strong>.</p><p class="lab-note">Carry and signed overflow answer different questions. Carry detects an unsigned result beyond the register. Signed overflow detects a result outside the signed range.</p>`;
  };
  host.querySelector("#addRun")!.addEventListener("click", runAddition);
  host.querySelector("#demoUnsigned")!.addEventListener("click", () => { width = 8; widthEl.value = "8"; (host.querySelector<HTMLInputElement>("#addA")!).value = "255"; (host.querySelector<HTMLInputElement>("#addB")!).value = "1"; draw(); runAddition(); });
  host.querySelector("#demoSigned")!.addEventListener("click", () => { width = 8; widthEl.value = "8"; (host.querySelector<HTMLInputElement>("#addA")!).value = "127"; (host.querySelector<HTMLInputElement>("#addB")!).value = "1"; draw(); runAddition(); });
  host.querySelector("#challengeReveal")!.addEventListener("click", () => { host.querySelector<HTMLElement>("#challengeAnswer")!.innerHTML = `<p><code>11111111</code> does not change at all. Only the interpretation changes: unsigned is <strong>255</strong>; signed 8-bit two's complement is <strong>-1</strong>. This is the key idea: a register stores bits, while the program decides what those bits mean.</p>`; });
  draw(); runAddition();
}

registerLabModule({
  id: "number-systems",
  icon: "🔢",
  title: "Number Systems & Bits X-Ray",
  description: "Play with binary, decimal, hex, octal, signed and unsigned integers, bit positions, two's complement, carry, and overflow.",
  featured: true,
  render: renderNumberSystems
});
