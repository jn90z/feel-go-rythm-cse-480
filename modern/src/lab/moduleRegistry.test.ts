import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLabModulesForTests,
  listRegisteredLabModules,
  registerLabModule,
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

  it("notifies subscribers and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToLabModules(listener);
    registerLabModule({ id: "alpha", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registerLabModule({ id: "beta", icon: "B", title: "Beta", description: "Second", render: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("trims ids before storing them", () => {
    registerLabModule({ id: "  alpha  ", icon: "A", title: "Alpha", description: "First", render: () => undefined });
    expect(listRegisteredLabModules()[0].id).toBe("alpha");
  });
});
