import { describe, expect, it } from "vitest";
import { getLabCategory, matchesLabCatalogItem } from "./moduleCatalog";

describe("Big Brain module catalog", () => {
  it("classifies known modules into learning domains", () => {
    expect(getLabCategory("sorting")).toBe("Algorithms");
    expect(getLabCategory("page-replacement")).toBe("Operating Systems");
    expect(getLabCategory("reliable-transport")).toBe("Networking");
    expect(getLabCategory("compiler-explorer")).toBe("Programming & Compilers");
    expect(getLabCategory("avl-tree")).toBe("Data Structures");
  });

  it("falls back to meaningful title and description keywords", () => {
    expect(getLabCategory("future-module", "Packet Routing", "Explore routers")).toBe("Networking");
    expect(getLabCategory("future-module", "Mutex Playground", "Coordinate threads")).toBe("Operating Systems");
    expect(getLabCategory("future-module", "Mystery", "General CS concept")).toBe("Foundations");
  });

  it("filters by both category and text without case sensitivity", () => {
    const item = {
      id: "weighted-pathfinding",
      title: "Weighted Pathfinding",
      description: "Compare Dijkstra and A*",
      category: getLabCategory("weighted-pathfinding")
    };
    expect(matchesLabCatalogItem(item, "dijkstra", "All")).toBe(true);
    expect(matchesLabCatalogItem(item, "PATH", "Algorithms")).toBe(true);
    expect(matchesLabCatalogItem(item, "path", "Networking")).toBe(false);
  });
});
