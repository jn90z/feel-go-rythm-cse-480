import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLabModulesForTests,
  listRegisteredLabModules,
  makeIdempotentLabCleanup,
  registerLabModule,
  renderRegisteredLabModule,
  runLabModuleCleanup,
  subscribeToLabModules
} from "./moduleRegistry";

describe("Big Brain module registry", () => {
  beforeEach(() => clearLabModulesForTests());

  it("registers modules in insertion order", () => {
    registerLabModule({ id: "alpha", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    registerLabModule({ id: "beta", icon: "B", title: "Beta", description: "Second", render: () => undefined });

    expect(listRegisteredLabModules().map(module => module.id)).toEqual(["alpha", "beta"]);
  });

  it("rejects duplicate module ids", () => {
    registerLabModule({ id: "alpha", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    expect(() => registerLabModule({ id: "alpha", icon: "A2", title: "Again", description: "Duplicate", render: () => undefined }))
      .toThrow("already registered");
  });

  it("notifies subscribers and supports idempotent unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLabModules(listener);
    registerLabModule({ id: "alpha", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    unsubscribe();
    registerLabModule({ id: "beta", icon: "B", title: "Beta", description: "Second", render: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("trims ids before storing them", () => {
    registerLabModule({ id: "  alpha  ", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    expect(listRegisteredLabModules()[0].id).toBe("alpha");
  });

  it("captures render failures instead of letting one module crash the registry bridge", () => {
    const broken = {
      id: "broken",
      icon: "!",
      title: "Broken",
      description: "Throws on render",
      render: () => { throw new Error("boom"); }
    };

    const result = renderRegisteredLabModule(broken, {} as HTMLElement);
    expect(result.cleanup).toBeNull();
    expect(result.error?.message).toBe("boom");
  });

  it("wraps successful cleanup callbacks so duplicate lifecycle signals only clean once", () => {
    const cleanup = vi.fn();
    const module = {
      id: "clean",
      icon: "C",
      title: "Clean",
      description: "Returns cleanup",
      render: () => cleanup
    };

    const result = renderRegisteredLabModule(module, {} as HTMLElement);
    expect(result.error).toBeNull();
    expect(result.cleanup).not.toBeNull();
    result.cleanup?.();
    result.cleanup?.();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("normalizes non-Error render failures", () => {
    const broken = {
      id: "broken-string",
      icon: "!",
      title: "Broken string",
      description: "Throws a string",
      render: () => { throw "bad module"; }
    };

    const result = renderRegisteredLabModule(broken, {} as HTMLElement);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("bad module");
  });

  it("isolates cleanup failures and normalizes thrown values", () => {
    const result = runLabModuleCleanup(() => { throw "cleanup failed"; });
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("cleanup failed");
  });

  it("marks cleanup complete before invoking it so even a throwing cleanup cannot run twice", () => {
    const cleanup = vi.fn(() => { throw new Error("boom"); });
    const guarded = makeIdempotentLabCleanup(cleanup);

    expect(() => guarded()).toThrow("boom");
    expect(() => guarded()).not.toThrow();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
