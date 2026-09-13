import { describe, expect, it } from "vitest";
import {
  MAX_SOURCE_LENGTH,
  compareCompilerResults,
  explainAssembly,
  normalizeCompilerSettings,
  parseCompilerResponse
} from "./compilerExplorerModel";

describe("compiler explorer learning model", () => {
  it("bounds source and allowlists compiler settings", () => {
    const normalized = normalizeCompilerSettings({
      source: "x".repeat(MAX_SOURCE_LENGTH + 25),
      language: "c",
      family: "clang",
      optimization: "-O3"
    });
    expect(normalized.source).toHaveLength(MAX_SOURCE_LENGTH);
    expect(normalized.language).toBe("c");
    expect(normalized.family).toBe("clang");
    expect(normalized.optimization).toBe("-O3");

    expect(normalizeCompilerSettings({ optimization: "-funtrusted" as never })).toMatchObject({
      language: "c++",
      family: "gcc",
      optimization: "-O2"
    });
  });

  it("classifies common x86-64 instructions for teaching explanations", () => {
    expect(explainAssembly("  call factorial").kind).toBe("call");
    expect(explainAssembly("  jne .L2").kind).toBe("branch");
    expect(explainAssembly("  mov eax, DWORD PTR [rdi]").kind).toBe("memory");
    expect(explainAssembly("  imul eax, edi").kind).toBe("arithmetic");
    expect(explainAssembly("  ret").kind).toBe("return");
    expect(explainAssembly(".L2:").kind).toBe("label");
  });

  it("parses source mappings, diagnostics, and bounded assembly metrics", () => {
    const result = parseCompilerResponse({
      code: 0,
      asm: [
        { text: "square(int):", source: { line: 1 } },
        { text: "  imul edi, edi", source: { line: 2 } },
        { text: "  mov eax, edi", source: { line: 2 } },
        { text: "  ret", source: { line: 3 } }
      ],
      stderr: [{ text: "warning: teaching warning" }]
    }, "GCC stable");

    expect(result.compilerName).toBe("GCC stable");
    expect(result.exitCode).toBe(0);
    expect(result.assembly[1].sourceLine).toBe(2);
    expect(result.metrics).toEqual({ instructions: 3, branches: 0, calls: 0, memoryOps: 1 });
    expect(result.diagnostics).toEqual(["warning: teaching warning"]);
  });

  it("compares two optimization outputs with an educational summary", () => {
    const left = parseCompilerResponse({ code: 0, asm: [
      { text: "push rbp" }, { text: "mov rbp, rsp" }, { text: "imul eax, edi" }, { text: "pop rbp" }, { text: "ret" }
    ]});
    const right = parseCompilerResponse({ code: 0, asm: [
      { text: "imul eax, edi" }, { text: "ret" }
    ]});
    const comparison = compareCompilerResults(left, right);
    expect(comparison.instructionDelta).toBe(-3);
    expect(comparison.summary).toContain("3 fewer instructions");
  });
});
