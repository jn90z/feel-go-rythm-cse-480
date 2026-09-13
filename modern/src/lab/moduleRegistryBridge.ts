import {
  listRegisteredLabModules,
  subscribeToLabModules,
  type LabModuleCleanup,
  type RegisteredLabModule
} from "./moduleRegistry";
import {
  getLabCategory,
  LAB_CATEGORIES,
  matchesLabCatalogItem,
  type LabCategory
} from "./moduleCatalog";

const overlay = document.querySelector<HTMLElement>(".lab-overlay");
const body = overlay?.querySelector<HTMLElement>(".lab-body");
const heading = overlay?.querySelector<HTMLHeadingElement>("h2");
const back = overlay?.querySelector<HTMLButtonElement>(".lab-back");
const graphHome = overlay?.querySelector<HTMLButtonElement>(".lab-home");

let activeCleanup: LabModuleCleanup | null = null;
let activeCategory: LabCategory | "All" = "All";
let activeQuery = "";

function cleanupActiveModule(): void {
  activeCleanup?.();
  activeCleanup = null;
}

function openRegisteredModule(module: RegisteredLabModule): void {
  if (!body || !heading || !back) return;
  cleanupActiveModule();
  back.hidden = false;
  heading.textContent = module.title;
  body.replaceChildren();
  const host = document.createElement("div");
  host.dataset.registeredLabHost = module.id;
  body.append(host);
  activeCleanup = module.render(host) ?? null;
}

function createRegisteredCard(module: RegisteredLabModule): HTMLButtonElement {
  const category = getLabCategory(module.id, module.title, module.description);
  const card = document.createElement("button");
  card.type = "button";
  card.className = `lab-card${module.featured ? " lab-card-featured" : ""}`;
  card.dataset.registeredModule = module.id;
  card.dataset.labCategory = category;

  const icon = document.createElement("span");
  icon.className = "lab-icon";
  icon.textContent = module.icon;

  const title = document.createElement("h3");
  title.textContent = module.title;

  const description = document.createElement("p");
  description.textContent = module.description;

  const badge = document.createElement("small");
  badge.className = "lab-note";
  const status = module.replacesLegacyId
    ? "Updated lab"
    : module.featured
      ? "Featured"
      : "Advanced lab";
  badge.textContent = `${category} · ${status}`;

  card.append(icon, title, description, badge);
  card.addEventListener("click", () => openRegisteredModule(module));
  return card;
}

function ensureHubSummary(grid: HTMLElement): HTMLElement | null {
  if (!body) return null;
  let summary = body.querySelector<HTMLElement>("[data-module-hub-summary]");
  if (!summary) {
    summary = document.createElement("p");
    summary.dataset.moduleHubSummary = "true";
    summary.className = "lab-note module-hub-summary";
    body.insertBefore(summary, grid);
  }
  return summary;
}

function catalogItemForCard(card: HTMLElement) {
  const id = card.dataset.registeredModule ?? card.dataset.module ?? "unknown";
  const title = card.querySelector("h3")?.textContent?.trim() ?? id;
  const description = card.querySelector("p")?.textContent?.trim() ?? "";
  const category = getLabCategory(id, title, description);
  card.dataset.labCategory = category;
  return { id, title, description, category };
}

function updateHubFilters(grid: HTMLElement): void {
  const cards = [...grid.querySelectorAll<HTMLElement>(".lab-card")];
  let visible = 0;
  for (const card of cards) {
    const item = catalogItemForCard(card);
    const show = matchesLabCatalogItem(item, activeQuery, activeCategory);
    card.hidden = !show;
    if (show) visible++;
  }

  const summary = ensureHubSummary(grid);
  if (summary) {
    const filtered = activeCategory !== "All" || activeQuery.trim().length > 0;
    summary.textContent = filtered
      ? `${visible} of ${cards.length} learning modules match your filters.`
      : `${cards.length} learning modules available. Choose a topic or search for a concept.`;
  }

  body?.querySelectorAll<HTMLButtonElement>("[data-module-category]").forEach(button => {
    const pressed = button.dataset.moduleCategory === activeCategory;
    button.setAttribute("aria-pressed", String(pressed));
  });
}

function ensureHubControls(grid: HTMLElement): void {
  if (!body || body.querySelector("[data-module-hub-controls]")) return;

  const controls = document.createElement("section");
  controls.className = "module-hub-controls";
  controls.dataset.moduleHubControls = "true";

  const intro = document.createElement("div");
  intro.className = "module-hub-intro";
  const title = document.createElement("strong");
  title.textContent = "What do you want to understand?";
  const note = document.createElement("p");
  note.className = "lab-note";
  note.textContent = "Start with a topic, search a concept, then open a lab and learn by stepping through what changes.";
  intro.append(title, note);

  const searchLabel = document.createElement("label");
  searchLabel.className = "module-hub-search";
  const searchText = document.createElement("span");
  searchText.textContent = "Search modules";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Try sorting, deadlock, packets, compiler…";
  search.autocomplete = "off";
  search.addEventListener("input", () => {
    activeQuery = search.value;
    updateHubFilters(grid);
  });
  searchLabel.append(searchText, search);

  const categories = document.createElement("div");
  categories.className = "module-hub-categories";
  categories.setAttribute("aria-label", "Filter learning modules by topic");
  (["All", ...LAB_CATEGORIES] as const).forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.moduleCategory = category;
    button.textContent = category === "All" ? "All topics" : category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => {
      activeCategory = category;
      updateHubFilters(grid);
    });
    categories.append(button);
  });

  controls.append(intro, searchLabel, categories);
  body.insertBefore(controls, grid);
}

function renderRegisteredCards(): void {
  if (!body) return;
  const grid = body.querySelector<HTMLElement>(".lab-home-grid");
  if (!grid) return;

  const modules = listRegisteredLabModules();
  for (const module of modules) {
    if (!module.replacesLegacyId) continue;
    grid.querySelector<HTMLElement>(`[data-module="${CSS.escape(module.replacesLegacyId)}"]`)?.remove();
  }

  const legacyAnchor = grid.querySelector<HTMLElement>("[data-module]");
  for (const module of modules) {
    if (grid.querySelector(`[data-registered-module="${CSS.escape(module.id)}"]`)) continue;
    const card = createRegisteredCard(module);
    grid.insertBefore(card, legacyAnchor);
  }

  ensureHubControls(grid);
  updateHubFilters(grid);
}

if (overlay && body) {
  const bodyObserver = new MutationObserver(() => {
    if (!body.querySelector("[data-registered-lab-host]")) cleanupActiveModule();
    renderRegisteredCards();
  });
  bodyObserver.observe(body, { childList: true, subtree: true });

  const overlayObserver = new MutationObserver(() => {
    if (overlay.hidden) cleanupActiveModule();
  });
  overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });

  subscribeToLabModules(renderRegisteredCards);
  back?.addEventListener("click", cleanupActiveModule, { capture: true });
  graphHome?.addEventListener("click", cleanupActiveModule, { capture: true });
  renderRegisteredCards();
}
