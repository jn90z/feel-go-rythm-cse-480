import "./compilerExplorerLab.css";
import { registerLabModule, type LabModuleCleanup } from "./moduleRegistry";
import {
  COMPILER_PRESETS,
  MAX_SOURCE_LENGTH,
  compareCompilerResults,
  normalizeCompilerSettings,
  type CompilerFamily,
  type CompilerLanguage,
  type CompilerResult,
  type OptimizationLevel
} from "./compilerExplorerModel";
import { compileWithCompilerExplorer } from "./compilerExplorerService";
import { buildSourceSiliconTrace, SOURCE_SILICON_MAX_INDEX } from "./sourceSiliconModel";

function selectSourceLine(editor: HTMLTextAreaElement, lineNumber: number): void {
  const lines = editor.value.split("\n");
  if (lineNumber < 1 || lineNumber > lines.length) return;
  const start = lines.slice(0, lineNumber - 1).reduce((total, line) => total + line.length + 1, 0);
  const end = start + lines[lineNumber - 1].length;
  editor.focus();
  editor.setSelectionRange(start, end);
}

function metricText(result: CompilerResult): string {
  const m = result.metrics;
  return `${m.instructions} instructions · ${m.branches} branches · ${m.calls} calls · ${m.memoryOps} memory ops`;
}

function renderCompilerExplorer(host: HTMLElement): LabModuleCleanup {
  host.innerHTML = `
    <div class="lab-module compiler-lab">
      <div class="lab-controls compiler-toolbar">
        <label>Example
          <select id="compilerPreset"></select>
        </label>
        <label>Language
          <select id="compilerLanguage"><option value="c++">C++</option><option value="c">C</option></select>
        </label>
        <label>Compiler
          <select id="compilerFamily"><option value="gcc">GCC</option><option value="clang">Clang</option></select>
        </label>
        <label>Optimization
          <select id="compilerOptimization">
            <option value="-O0">-O0</option><option value="-O1">-O1</option><option value="-O2" selected>-O2</option><option value="-O3">-O3</option><option value="-Os">-Os</option>
          </select>
        </label>
        <button id="compilerCompile" type="button">Compile</button>
        <button id="compilerCompare" type="button">Compare -O0 vs -O2</button>
      </div>

      <div class="compiler-status" id="compilerStatus" role="status" aria-live="polite">Ready. Live compilation uses Compiler Explorer; code is compiled, never executed.</div>

      <div class="compiler-workspace">
        <section class="lab-panel compiler-pane">
          <div class="compiler-pane-title"><strong>Source</strong><span id="compilerSourceCount"></span></div>
          <textarea id="compilerSource" class="compiler-editor" spellcheck="false" maxlength="${MAX_SOURCE_LENGTH}" aria-label="C or C++ source code"></textarea>
        </section>

        <section class="lab-panel compiler-pane">
          <div class="compiler-pane-title"><strong>Assembly</strong><span id="compilerName">Not compiled</span></div>
          <div id="compilerAssembly" class="compiler-assembly" tabindex="0" aria-label="Generated assembly"></div>
        </section>

        <section class="lab-panel compiler-pane compiler-learning-pane">
          <div class="compiler-pane-title"><strong>Big Brain explanation</strong><span id="compilerMetrics"></span></div>
          <div class="compiler-explanation-card">
            <strong id="compilerInstruction">Select an assembly instruction</strong>
            <p id="compilerExplanation">Compile the example, then click an assembly line. If Compiler Explorer reports source mapping, the matching source line will be selected automatically.</p>
          </div>
          <div>
            <strong>Diagnostics</strong>
            <div id="compilerDiagnostics" class="compiler-diagnostics"></div>
          </div>
        </section>
      </div>

      <section class="lab-panel compiler-compare" id="compilerComparison" hidden>
        <strong>Optimization comparison</strong>
        <p id="compilerComparisonSummary" class="lab-note"></p>
        <div id="compilerComparisonGrid" class="compiler-comparison-grid"></div>
      </section>

      <section class="lab-panel source-silicon-xray">
        <div class="source-silicon-header">
          <div><strong>🔬 Source-to-Silicon X-Ray</strong><p class="lab-note">Follow one ordinary C++ array operation until it becomes a concrete byte address the memory system must service.</p></div>
          <span class="source-silicon-badge">deterministic teaching model</span>
        </div>
        <div class="lab-controls source-silicon-controls">
          <label>Array index i
            <input id="siliconIndex" type="range" min="0" max="${SOURCE_SILICON_MAX_INDEX}" step="1" value="3" aria-label="Array index">
            <output id="siliconIndexValue">3</output>
          </label>
          <button id="siliconPrev" type="button">Previous stage</button>
          <button id="siliconPlay" type="button">Play</button>
          <button id="siliconNext" type="button">Next stage</button>
        </div>
        <div class="source-silicon-track" id="siliconTrack" aria-label="Source to silicon stages"></div>
        <div class="source-silicon-stage">
          <div class="source-silicon-stage-heading"><strong id="siliconStageTitle"></strong><span id="siliconStageCount"></span></div>
          <pre id="siliconStageCode"></pre>
          <p id="siliconStageExplanation" class="lab-note"></p>
        </div>
        <label class="source-silicon-scrubber">Stage
          <input id="siliconStage" type="range" min="0" max="7" step="1" value="0" aria-label="Source to silicon stage">
        </label>
        <div class="source-silicon-predict">
          <div><strong>Predict before reveal</strong><p class="lab-note">If <code>i</code> increases by 1 and each element is a 32-bit <code>int</code>, how far should the effective byte address move?</p></div>
          <div class="source-silicon-predict-actions" role="group" aria-label="Effective address prediction">
            <button type="button" data-silicon-predict="1">+1 byte</button>
            <button type="button" data-silicon-predict="4">+4 bytes</button>
            <button type="button" data-silicon-predict="8">+8 bytes</button>
          </div>
          <p id="siliconPrediction" class="source-silicon-prediction" aria-live="polite">Choose a prediction to reveal why.</p>
        </div>
        <div class="source-silicon-handoff">
          <strong>Bridge to Memory Journey</strong>
          <span id="siliconHandoff"></span>
          <span class="lab-note">From here the address can flow through the TLB, page table, cache, and physical memory—the exact hidden state visualized in Memory Journey X-Ray.</span>
        </div>
      </section>

      <section class="lab-panel">
        <strong>What to learn</strong>
        <p class="lab-note">Change one idea at a time: source construct, compiler family, or optimization level. Watch how calls, branches, memory traffic, and instruction count change. Then use Source-to-Silicon X-Ray to connect source syntax to the address-generation hardware beneath the assembly. This lab intentionally does not execute arbitrary code.</p>
      </section>
    </div>`;

  const preset = host.querySelector<HTMLSelectElement>("#compilerPreset")!;
  const language = host.querySelector<HTMLSelectElement>("#compilerLanguage")!;
  const family = host.querySelector<HTMLSelectElement>("#compilerFamily")!;
  const optimization = host.querySelector<HTMLSelectElement>("#compilerOptimization")!;
  const source = host.querySelector<HTMLTextAreaElement>("#compilerSource")!;
  const compileButton = host.querySelector<HTMLButtonElement>("#compilerCompile")!;
  const compareButton = host.querySelector<HTMLButtonElement>("#compilerCompare")!;
  const status = host.querySelector<HTMLElement>("#compilerStatus")!;
  const assembly = host.querySelector<HTMLElement>("#compilerAssembly")!;
  const diagnostics = host.querySelector<HTMLElement>("#compilerDiagnostics")!;
  const explanation = host.querySelector<HTMLElement>("#compilerExplanation")!;
  const instruction = host.querySelector<HTMLElement>("#compilerInstruction")!;
  const comparisonPanel = host.querySelector<HTMLElement>("#compilerComparison")!;
  const siliconIndex = host.querySelector<HTMLInputElement>("#siliconIndex")!;
  const siliconStage = host.querySelector<HTMLInputElement>("#siliconStage")!;
  const siliconTrack = host.querySelector<HTMLElement>("#siliconTrack")!;
  const siliconPlay = host.querySelector<HTMLButtonElement>("#siliconPlay")!;
  let requestGeneration = 0;
  let activeRequest: AbortController | null = null;
  let siliconTimer: number | null = null;

  const beginRequest = (): { generation: number; controller: AbortController } => {
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    return { generation: ++requestGeneration, controller };
  };

  const finishRequest = (generation: number, controller: AbortController): void => {
    if (generation === requestGeneration && activeRequest === controller) activeRequest = null;
  };

  COMPILER_PRESETS.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    preset.append(option);
  });

  const updateSourceCount = () => {
    host.querySelector<HTMLElement>("#compilerSourceCount")!.textContent = `${source.value.length.toLocaleString()} / ${MAX_SOURCE_LENGTH.toLocaleString()} chars`;
  };

  const loadPreset = () => {
    const selected = COMPILER_PRESETS.find(item => item.id === preset.value) ?? COMPILER_PRESETS[0];
    source.value = selected.source;
    language.value = selected.language;
    comparisonPanel.hidden = true;
    updateSourceCount();
  };

  const settings = (overrideOptimization?: OptimizationLevel) => normalizeCompilerSettings({
    source: source.value,
    language: language.value as CompilerLanguage,
    family: family.value as CompilerFamily,
    optimization: overrideOptimization ?? optimization.value as OptimizationLevel
  });

  const drawResult = (result: CompilerResult) => {
    host.querySelector<HTMLElement>("#compilerName")!.textContent = result.compilerName;
    host.querySelector<HTMLElement>("#compilerMetrics")!.textContent = metricText(result);
    assembly.replaceChildren();

    if (!result.assembly.length) {
      const empty = document.createElement("p");
      empty.className = "lab-note";
      empty.textContent = result.exitCode === 0 ? "No assembly was returned." : "Compilation failed before assembly was generated.";
      assembly.append(empty);
    } else {
      result.assembly.forEach((line, index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `compiler-asm-line kind-${line.kind}`;
        const lineNo = document.createElement("span");
        lineNo.className = "compiler-asm-index";
        lineNo.textContent = String(index + 1);
        const code = document.createElement("code");
        code.textContent = line.text || " ";
        const sourceTag = document.createElement("span");
        sourceTag.className = "compiler-source-tag";
        sourceTag.textContent = line.sourceLine ? `src ${line.sourceLine}` : "";
        row.append(lineNo, code, sourceTag);
        row.addEventListener("click", () => {
          assembly.querySelectorAll(".active").forEach(item => item.classList.remove("active"));
          row.classList.add("active");
          instruction.textContent = line.text.trim() || `Assembly line ${index + 1}`;
          explanation.textContent = line.explanation;
          if (line.sourceLine) selectSourceLine(source, line.sourceLine);
        });
        assembly.append(row);
      });
    }

    diagnostics.replaceChildren();
    const messages = result.diagnostics.length ? result.diagnostics : [result.exitCode === 0 ? "No compiler diagnostics." : `Compiler exited with code ${result.exitCode}.`];
    messages.forEach(message => {
      const row = document.createElement("div");
      row.textContent = message;
      diagnostics.append(row);
    });
  };

  const compile = async () => {
    const { generation, controller } = beginRequest();
    comparisonPanel.hidden = true;
    compileButton.disabled = true;
    compareButton.disabled = true;
    status.textContent = "Compiling with Compiler Explorer…";
    try {
      const result = await compileWithCompilerExplorer(settings(), controller.signal);
      if (generation !== requestGeneration) return;
      drawResult(result);
      status.textContent = result.exitCode === 0
        ? `Compiled successfully with ${result.compilerName}. Click an assembly line to connect it back to the source.`
        : `Compilation finished with errors (exit ${result.exitCode}). Check diagnostics.`;
    } catch (error) {
      if (generation !== requestGeneration) return;
      status.textContent = error instanceof Error ? error.message : "Compilation failed.";
    } finally {
      finishRequest(generation, controller);
      if (generation === requestGeneration) {
        compileButton.disabled = false;
        compareButton.disabled = false;
      }
    }
  };

  const compare = async () => {
    const { generation, controller } = beginRequest();
    compileButton.disabled = true;
    compareButton.disabled = true;
    status.textContent = "Compiling the same source at -O0 and -O2…";
    try {
      const [left, right] = await Promise.all([
        compileWithCompilerExplorer(settings("-O0"), controller.signal),
        compileWithCompilerExplorer(settings("-O2"), controller.signal)
      ]);
      if (generation !== requestGeneration) return;
      const comparison = compareCompilerResults(left, right);
      host.querySelector<HTMLElement>("#compilerComparisonSummary")!.textContent = comparison.summary;
      const grid = host.querySelector<HTMLElement>("#compilerComparisonGrid")!;
      grid.replaceChildren();
      [["-O0", left], ["-O2", right]].forEach(([label, result]) => {
        const card = document.createElement("article");
        card.className = "compiler-comparison-card";
        const title = document.createElement("h4");
        title.textContent = `${label} · ${(result as CompilerResult).compilerName}`;
        const metrics = document.createElement("p");
        metrics.textContent = metricText(result as CompilerResult);
        card.append(title, metrics);
        grid.append(card);
      });
      comparisonPanel.hidden = false;
      status.textContent = "Optimization comparison ready. Use the counts as a clue, then inspect the actual instructions.";
    } catch (error) {
      if (generation !== requestGeneration) return;
      status.textContent = error instanceof Error ? error.message : "Comparison failed.";
    } finally {
      finishRequest(generation, controller);
      if (generation === requestGeneration) {
        compileButton.disabled = false;
        compareButton.disabled = false;
      }
    }
  };

  const stopSiliconPlayback = () => {
    if (siliconTimer !== null) window.clearInterval(siliconTimer);
    siliconTimer = null;
    siliconPlay.textContent = "Play";
  };

  const drawSilicon = () => {
    const trace = buildSourceSiliconTrace(Number(siliconIndex.value));
    const stageIndex = Math.min(trace.stages.length - 1, Math.max(0, Number(siliconStage.value) || 0));
    const stage = trace.stages[stageIndex];
    host.querySelector<HTMLOutputElement>("#siliconIndexValue")!.value = String(trace.index);
    host.querySelector<HTMLElement>("#siliconStageTitle")!.textContent = stage.title;
    host.querySelector<HTMLElement>("#siliconStageCount")!.textContent = `${stageIndex + 1} / ${trace.stages.length}`;
    host.querySelector<HTMLElement>("#siliconStageCode")!.textContent = stage.code;
    host.querySelector<HTMLElement>("#siliconStageExplanation")!.textContent = stage.explanation;
    host.querySelector<HTMLElement>("#siliconHandoff")!.textContent = `Effective address 0x${trace.effectiveAddress.toString(16)} is ready for translation and caching.`;
    siliconTrack.replaceChildren();
    trace.stages.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "source-silicon-node";
      button.textContent = item.id;
      button.setAttribute("aria-pressed", String(index === stageIndex));
      if (index <= stageIndex) button.classList.add("visited");
      button.addEventListener("click", () => {
        stopSiliconPlayback();
        siliconStage.value = String(index);
        drawSilicon();
      }, { once: true });
      siliconTrack.append(button);
    });
  };

  const moveSiliconStage = (delta: number) => {
    stopSiliconPlayback();
    siliconStage.value = String(Math.min(7, Math.max(0, Number(siliconStage.value) + delta)));
    drawSilicon();
  };

  preset.addEventListener("change", loadPreset);
  source.addEventListener("input", updateSourceCount);
  compileButton.addEventListener("click", compile);
  compareButton.addEventListener("click", compare);
  siliconIndex.addEventListener("input", () => {
    stopSiliconPlayback();
    host.querySelector<HTMLElement>("#siliconPrediction")!.textContent = "Choose a prediction to reveal why.";
    drawSilicon();
  });
  siliconStage.addEventListener("input", () => {
    stopSiliconPlayback();
    drawSilicon();
  });
  host.querySelector<HTMLButtonElement>("#siliconPrev")!.addEventListener("click", () => moveSiliconStage(-1));
  host.querySelector<HTMLButtonElement>("#siliconNext")!.addEventListener("click", () => moveSiliconStage(1));
  siliconPlay.addEventListener("click", () => {
    if (siliconTimer !== null) {
      stopSiliconPlayback();
      return;
    }
    siliconPlay.textContent = "Pause";
    if (Number(siliconStage.value) >= 7) siliconStage.value = "0";
    drawSilicon();
    siliconTimer = window.setInterval(() => {
      const next = Number(siliconStage.value) + 1;
      if (next > 7) {
        stopSiliconPlayback();
        return;
      }
      siliconStage.value = String(next);
      drawSilicon();
    }, 900);
  });
  host.querySelectorAll<HTMLButtonElement>("[data-silicon-predict]").forEach(button => {
    button.addEventListener("click", () => {
      const prediction = Number(button.dataset.siliconPredict);
      const feedback = host.querySelector<HTMLElement>("#siliconPrediction")!;
      feedback.textContent = prediction === 4
        ? "Correct: a 32-bit int occupies 4 bytes, so i + 1 advances the effective address by 4 bytes."
        : `Not quite: ${prediction > 4 ? "8 bytes would skip one 32-bit int" : "array indexing advances by element size, not one raw byte"}. The correct stride is +4 bytes.`;
    });
  });
  loadPreset();
  drawSilicon();

  return () => {
    requestGeneration += 1;
    activeRequest?.abort();
    activeRequest = null;
    stopSiliconPlayback();
  };
}

registerLabModule({
  id: "compiler-explorer",
  icon: "C→ASM",
  title: "Compiler Explorer",
  description: "Edit C/C++, compile with live GCC or Clang, connect source to assembly, and X-ray one array expression all the way to CPU address generation.",
  featured: true,
  render: renderCompilerExplorer
});
