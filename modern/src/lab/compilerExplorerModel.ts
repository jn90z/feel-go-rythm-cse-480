export type CompilerLanguage = "c" | "c++";
export type CompilerFamily = "gcc" | "clang";
export type OptimizationLevel = "-O0" | "-O1" | "-O2" | "-O3" | "-Os";

export interface CompilerSettings {
  source: string;
  language: CompilerLanguage;
  family: CompilerFamily;
  optimization: OptimizationLevel;
}

export interface CompilerAsmLine {
  text: string;
  sourceLine: number | null;
  explanation: string;
  kind: "label" | "branch" | "call" | "memory" | "arithmetic" | "return" | "other";
}

export interface CompilerMetrics {
  instructions: number;
  branches: number;
  calls: number;
  memoryOps: number;
}

export interface CompilerResult {
  compilerName: string;
  exitCode: number;
  assembly: CompilerAsmLine[];
  diagnostics: string[];
  metrics: CompilerMetrics;
}

export const MAX_SOURCE_LENGTH = 20_000;
export const OPTIMIZATION_LEVELS: readonly OptimizationLevel[] = ["-O0", "-O1", "-O2", "-O3", "-Os"];

export const COMPILER_PRESETS = [
  {
    id: "square",
    label: "Simple function",
    language: "c++" as CompilerLanguage,
    source: "int square(int x) {\n    return x * x;\n}\n"
  },
  {
    id: "loop",
    label: "Array sum loop",
    language: "c++" as CompilerLanguage,
    source: "int sum(const int* values, int count) {\n    int total = 0;\n    for (int i = 0; i < count; ++i) {\n        total += values[i];\n    }\n    return total;\n}\n"
  },
  {
    id: "branch",
    label: "Branching",
    language: "c" as CompilerLanguage,
    source: "int absolute_value(int x) {\n    if (x < 0) return -x;\n    return x;\n}\n"
  },
  {
    id: "recursion",
    label: "Recursion",
    language: "c++" as CompilerLanguage,
    source: "int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n"
  }
] as const;

export function normalizeCompilerSettings(input: Partial<CompilerSettings>): CompilerSettings {
  const language: CompilerLanguage = input.language === "c" ? "c" : "c++";
  const family: CompilerFamily = input.family === "clang" ? "clang" : "gcc";
  const optimization = OPTIMIZATION_LEVELS.includes(input.optimization as OptimizationLevel)
    ? input.optimization as OptimizationLevel
    : "-O2";
  const source = String(input.source ?? "").slice(0, MAX_SOURCE_LENGTH);
  return { source, language, family, optimization };
}

function instructionMnemonic(text: string): string {
  const stripped = text.replace(/^\s*[0-9a-f]+:\s*/i, "").trim();
  return stripped.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9_.]/g, "") ?? "";
}

export function explainAssembly(text: string): Pick<CompilerAsmLine, "explanation" | "kind"> {
  const trimmed = text.trim();
  if (!trimmed) return { explanation: "Blank output line.", kind: "other" };
  if (trimmed.endsWith(":")) return { explanation: "A label marks a location that branches or calls can target.", kind: "label" };

  const mnemonic = instructionMnemonic(trimmed);
  if (/^(ret|retq)$/.test(mnemonic)) return { explanation: "Return to the caller. Integer return values are commonly left in EAX/RAX on x86-64.", kind: "return" };
  if (/^call/.test(mnemonic)) return { explanation: "Call another function, saving a return address so execution can come back here.", kind: "call" };
  if (/^(j|loop)/.test(mnemonic)) return { explanation: "Control-flow instruction: execution may jump to another label instead of continuing sequentially.", kind: "branch" };
  if (/^(mov|lea|push|pop|load|store)/.test(mnemonic) || /\[[^\]]+\]|\([^)]*%[a-z]+[^)]*\)/i.test(trimmed)) {
    return { explanation: "Moves data between registers and/or memory. Memory operands reveal where the program loads or stores values.", kind: "memory" };
  }
  if (/^(add|sub|imul|mul|idiv|div|inc|dec|and|or|xor|shl|shr|sal|sar)/.test(mnemonic)) {
    return { explanation: "Arithmetic or bitwise work transforms values already held in registers or memory.", kind: "arithmetic" };
  }
  if (/^(cmp|test)/.test(mnemonic)) return { explanation: "Compares values by updating condition flags that a later conditional branch can inspect.", kind: "branch" };
  return { explanation: "A machine instruction emitted by the compiler. Step through nearby lines to infer its role from the surrounding data flow.", kind: "other" };
}

interface RawAsmLine {
  text?: unknown;
  source?: { line?: unknown } | null;
}

interface RawCompileResponse {
  code?: unknown;
  asm?: unknown;
  stderr?: unknown;
  stdout?: unknown;
  inputFilename?: unknown;
}

function collectDiagnostics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === "string" ? item : (item && typeof item === "object" && "text" in item ? String((item as { text?: unknown }).text ?? "") : ""))
    .map(text => text.trim())
    .filter(Boolean)
    .slice(0, 100);
}

export function parseCompilerResponse(raw: RawCompileResponse, compilerName = "Compiler Explorer"): CompilerResult {
  const assembly = Array.isArray(raw.asm)
    ? (raw.asm as RawAsmLine[]).slice(0, 5000).map(item => {
        const text = String(item?.text ?? "");
        const sourceLineValue = item?.source?.line;
        const sourceLine = Number.isInteger(sourceLineValue) && Number(sourceLineValue) > 0 ? Number(sourceLineValue) : null;
        const explained = explainAssembly(text);
        return { text, sourceLine, ...explained };
      })
    : [];

  const metrics: CompilerMetrics = assembly.reduce((totals, line) => {
    if (line.kind !== "label" && line.text.trim()) totals.instructions++;
    if (line.kind === "branch") totals.branches++;
    if (line.kind === "call") totals.calls++;
    if (line.kind === "memory") totals.memoryOps++;
    return totals;
  }, { instructions: 0, branches: 0, calls: 0, memoryOps: 0 });

  return {
    compilerName,
    exitCode: Number.isFinite(Number(raw.code)) ? Number(raw.code) : -1,
    assembly,
    diagnostics: [...collectDiagnostics(raw.stderr), ...collectDiagnostics(raw.stdout)].slice(0, 100),
    metrics
  };
}

export interface CompilerComparison {
  left: CompilerResult;
  right: CompilerResult;
  instructionDelta: number;
  summary: string;
}

export function compareCompilerResults(left: CompilerResult, right: CompilerResult): CompilerComparison {
  const instructionDelta = right.metrics.instructions - left.metrics.instructions;
  const summary = instructionDelta === 0
    ? "Both outputs use the same instruction count; inspect branches, calls, and memory operations for subtler differences."
    : instructionDelta < 0
      ? `The right-hand build uses ${Math.abs(instructionDelta)} fewer instruction${Math.abs(instructionDelta) === 1 ? "" : "s"}.`
      : `The right-hand build uses ${instructionDelta} more instruction${instructionDelta === 1 ? "" : "s"}.`;
  return { left, right, instructionDelta, summary };
}
