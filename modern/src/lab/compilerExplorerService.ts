import {
  normalizeCompilerSettings,
  parseCompilerResponse,
  type CompilerFamily,
  type CompilerLanguage,
  type CompilerResult,
  type CompilerSettings
} from "./compilerExplorerModel";

const API_BASE = "https://godbolt.org/api";
const REQUEST_TIMEOUT_MS = 12_000;

interface CompilerDescriptor {
  id?: unknown;
  name?: unknown;
  compilerType?: unknown;
  releaseTrack?: unknown;
}

function compilerMatchesFamily(compiler: CompilerDescriptor, family: CompilerFamily): boolean {
  const haystack = `${String(compiler.compilerType ?? "")} ${String(compiler.name ?? "")}`.toLowerCase();
  return family === "gcc" ? /gcc|g\+\+|gnu/.test(haystack) : /clang|llvm/.test(haystack);
}

function chooseCompiler(compilers: CompilerDescriptor[], family: CompilerFamily): { id: string; name: string } {
  const candidates = compilers.filter(compiler => typeof compiler.id === "string" && compilerMatchesFamily(compiler, family));
  if (!candidates.length) throw new Error(`No ${family.toUpperCase()} compiler is currently available from Compiler Explorer.`);
  const stable = candidates.find(compiler => compiler.releaseTrack === "stable") ?? candidates[0];
  return { id: String(stable.id), name: String(stable.name ?? stable.id) };
}

function languageApiId(language: CompilerLanguage): string {
  return language === "c" ? "c" : "c++";
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) throw new Error(`Compiler Explorer returned HTTP ${response.status}.`);

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const text = await response.text();
    if (!text.trim()) throw new Error("Compiler Explorer returned an empty response.");

    try {
      return JSON.parse(text) as unknown;
    } catch {
      const looksLikeJson = contentType.includes("application/json") || /^[\[{]/.test(text.trim());
      throw new Error(
        looksLikeJson
          ? "Compiler Explorer returned malformed JSON. Try again in a moment."
          : "Compiler Explorer returned a non-JSON response. Its public API may be unavailable or blocked from this browser."
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Compiler Explorer took too long to respond. Try again in a moment.");
    }
    if (error instanceof TypeError) {
      throw new Error("Could not reach Compiler Explorer from this browser. Check the network connection or browser/CORS restrictions.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function compileWithCompilerExplorer(input: CompilerSettings): Promise<CompilerResult> {
  const settings = normalizeCompilerSettings(input);
  if (!settings.source.trim()) throw new Error("Enter some C or C++ source code first.");

  const language = languageApiId(settings.language);
  const compilerList = await fetchJson(`${API_BASE}/compilers/${encodeURIComponent(language)}?fields=id,name,compilerType,releaseTrack`);
  if (!Array.isArray(compilerList)) throw new Error("Compiler Explorer returned an unexpected compiler list.");
  const compiler = chooseCompiler(compilerList as CompilerDescriptor[], settings.family);
  const standard = settings.language === "c" ? "-std=c17" : "-std=c++20";

  const raw = await fetchJson(`${API_BASE}/compiler/${encodeURIComponent(compiler.id)}/compile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: settings.source,
      options: {
        userArguments: `${settings.optimization} ${standard}`,
        compilerOptions: {
          skipAsm: false,
          executorRequest: false,
          overrides: []
        },
        filters: {
          binary: false,
          binaryObject: false,
          commentOnly: true,
          demangle: true,
          directives: true,
          execute: false,
          intel: true,
          labels: true,
          libraryCode: false,
          trim: true
        },
        tools: [],
        libraries: []
      }
    })
  });

  if (!raw || typeof raw !== "object") throw new Error("Compiler Explorer returned an unexpected compile result.");
  return parseCompilerResponse(raw as Record<string, unknown>, compiler.name);
}
