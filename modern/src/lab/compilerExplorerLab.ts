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

      <section class="lab-panel">
        <strong>What to learn</strong>
        <p class="lab-note">Change one idea at a time: source construct, compiler family, or optimization level. Watch how calls, branches, memory traffic, and instruction count change. This lab intentionally does not execute arbitrary code.</p>
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
  let requestGeneration = 0;
  let activeRequest: AbortController | null = null;

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

  preset.addEventListener("change", loadPreset);
  source.addEventListener("input", updateSourceCount);
  compileButton.addEventListener("click", compile);
  compareButton.addEventListener("click", compare);
  loadPreset();

  return () => {
    requestGeneration += 1;
    activeRequest?.abort();
    activeRequest = null;
  };
}

registerLabModule({
  id: "compiler-explorer",
  icon: "C→ASM",
  title: "Compiler Explorer",
  description: "Edit C/C++, compile with live GCC or Clang through Compiler Explorer, connect source lines to assembly, and compare -O0 with -O2.",
  featured: true,
  render: renderCompilerExplorer
});
