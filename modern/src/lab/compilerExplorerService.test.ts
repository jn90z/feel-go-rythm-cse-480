import { afterEach, describe, expect, it, vi } from "vitest";
import { compileWithCompilerExplorer } from "./compilerExplorerService";
import type { CompilerSettings } from "./compilerExplorerModel";

const SETTINGS: CompilerSettings = {
  source: "int square(int x) { return x * x; }",
  language: "c++",
  family: "gcc",
  optimization: "-O2"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Compiler Explorer service cancellation", () => {
  it("does not start network work when the request is already cancelled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();

    await expect(compileWithCompilerExplorer(SETTINGS, controller.signal)).rejects.toThrow("Compilation cancelled.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts an in-flight Compiler Explorer request", async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const pending = compileWithCompilerExplorer(SETTINGS, controller.signal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.abort();

    await expect(pending).rejects.toThrow("Compilation cancelled.");
  });
});
