import {
  listRegisteredLabModules,
  subscribeToLabModules,
  type LabModuleCleanup,
  type RegisteredLabModule
} from "./moduleRegistry";

const overlay = document.querySelector<HTMLElement>(".lab-overlay");
const body = overlay?.querySelector<HTMLElement>(".lab-body");
const heading = overlay?.querySelector<HTMLHeadingElement>("h2");
const back = overlay?.querySelector<HTMLButtonElement>(".lab-back");
const graphHome = overlay?.querySelector<HTMLButtonElement>(".lab-home");

let activeCleanup: LabModuleCleanup | null = null;

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
  const card = document.createElement("button");
  card.type = "button";
  card.className = `lab-card${module.featured ? " lab-card-featured" : ""}`;
  card.dataset.registeredModule = module.id;

  const icon = document.createElement("span");
  icon.className = "lab-icon";
  icon.textContent = module.icon;

  const title = document.createElement("h3");
  title.textContent = module.title;

  const description = document.createElement("p");
  description.textContent = module.description;

  const badge = document.createElement("small");
  badge.className = "lab-note";
  badge.textContent = module.featured ? "Featured advanced lab" : "Advanced lab";

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
    summary.className = "lab-note";
    body.insertBefore(summary, grid);
  }
  return summary;
}

function renderRegisteredCards(): void {
  if (!body) return;
  const grid = body.querySelector<HTMLElement>(".lab-home-grid");
  if (!grid) return;

  const modules = listRegisteredLabModules();
  const legacyAnchor = grid.querySelector<HTMLElement>("[data-module]");

  for (const module of modules) {
    if (grid.querySelector(`[data-registered-module="${CSS.escape(module.id)}"]`)) continue;
    const card = createRegisteredCard(module);
    grid.insertBefore(card, legacyAnchor);
  }

  const summary = ensureHubSummary(grid);
  if (summary) {
    const legacyCount = grid.querySelectorAll("[data-module]").length;
    const registeredCount = grid.querySelectorAll("[data-registered-module]").length;
    const total = legacyCount + registeredCount;
    const nextText = `${total} learning modules available. Advanced and newly added labs are shown first.`;
    if (summary.textContent !== nextText) summary.textContent = nextText;
  }
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
