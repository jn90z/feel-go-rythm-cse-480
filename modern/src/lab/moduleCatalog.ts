export type LabCategory =
  | "Algorithms"
  | "Data Structures"
  | "Operating Systems"
  | "Networking"
  | "Programming & Compilers"
  | "AI & Machine Learning"
  | "Foundations";

export const LAB_CATEGORIES: readonly LabCategory[] = [
  "Algorithms",
  "Data Structures",
  "Operating Systems",
  "Networking",
  "Programming & Compilers",
  "AI & Machine Learning",
  "Foundations"
];

export interface LabCatalogItem {
  id: string;
  title: string;
  description: string;
  category: LabCategory;
}

const EXPLICIT_CATEGORY: Record<string, LabCategory> = {
  graphs: "Algorithms",
  sorting: "Algorithms",
  searching: "Algorithms",
  pathfinding: "Algorithms",
  "weighted-pathfinding": "Algorithms",
  "algorithm-math": "Algorithms",
  "fast-inverse-sqrt": "Algorithms",
  structures: "Data Structures",
  trees: "Data Structures",
  hashing: "Data Structures",
  "avl-tree": "Data Structures",
  "avl-trees": "Data Structures",
  memory: "Operating Systems",
  scheduling: "Operating Systems",
  concurrency: "Operating Systems",
  deadlock: "Operating Systems",
  deadlocks: "Operating Systems",
  "cpu-scheduling": "Operating Systems",
  "page-replacement": "Operating Systems",
  "cache-locality": "Operating Systems",
  networking: "Networking",
  "reliable-transport": "Networking",
  "encryption-keys": "Networking",
  "vpn-tunneling": "Networking",
  recursion: "Programming & Compilers",
  "call-stack": "Programming & Compilers",
  "recursion-call-stack": "Programming & Compilers",
  "compiler-explorer": "Programming & Compilers",
  "cpp-api-integration": "Programming & Compilers",
  "tiny-llm": "AI & Machine Learning",
  "train-neural-network": "AI & Machine Learning",
  "compression-zip": "Foundations",
  "turing-machine": "Foundations"
};

export function getLabCategory(id: string, title = "", description = ""): LabCategory {
  const explicit = EXPLICIT_CATEGORY[id];
  if (explicit) return explicit;

  const text = `${id} ${title} ${description}`.toLowerCase();
  if (/\bai\b|machine learning|neural|llm|transformer|attention|embedding|softmax/.test(text)) return "AI & Machine Learning";
  if (/network|packet|transport|tcp|udp|router|vpn|encrypt|tls|tunnel/.test(text)) return "Networking";
  if (/cpu|schedule|memory|cache|locality|page|deadlock|thread|concurr|mutex|process/.test(text)) return "Operating Systems";
  if (/tree|avl|stack|queue|hash|structure|heap/.test(text)) return "Data Structures";
  if (/compiler|assembly|recursion|call stack|language|api|sdk|http client/.test(text)) return "Programming & Compilers";
  if (/sort|search|path|graph|algorithm|vector|inverse square root/.test(text)) return "Algorithms";
  return "Foundations";
}

export function matchesLabCatalogItem(item: LabCatalogItem, query: string, category: LabCategory | "All"): boolean {
  if (category !== "All" && item.category !== category) return false;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(normalized);
}
