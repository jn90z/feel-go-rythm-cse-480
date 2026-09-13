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

function renderRegisteredCards(): void {
  if (!body) return;
  const grid = body.querySelector<HTMLElement>(".lab-home-grid");
  if (!grid) return;

  for (const module of listRegisteredLabModules()) {
    if (grid.querySelector(`[data-registered-module="${CSS.escape(module.id)}"]`)) continue;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `lab-card${module.featured ? " lab-card-featured" : ""}`;
    card.dataset.registeredModule = module.id;
    card.innerHTML = `<span class="lab-icon"></span><h3></h3><p></p>`;
    card.querySelector<HTMLElement>(".lab-icon")!.textContent = module.icon;
    card.querySelector<HTMLHeadingElement>("h3")!.textContent = module.title;
    card.querySelector<HTMLParagraphElement>("p")!.textContent = module.description;
    card.addEventListener("click", () => openRegisteredModule(module));
    grid.append(card);
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
