const isMobileLayout = (): boolean => window.matchMedia("(max-width: 820px)").matches;

const algorithmPanel = document.querySelector<HTMLElement>("#algorithmPanel");
const sheetToggle = document.querySelector<HTMLButtonElement>("#mobileSheetToggle");
const fullscreenButton = document.querySelector<HTMLButtonElement>("#fullscreenGraph");
const exitFullscreenButton = document.querySelector<HTMLButtonElement>("#exitFullscreenGraph");
const connectModeButton = document.querySelector<HTMLButtonElement>("#connectMode");
const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
const addEdgeButton = document.querySelector<HTMLButtonElement>("#addEdge");
const edgeEditor = document.querySelector<HTMLElement>(".edge-editor");
const toolbar = document.querySelector<HTMLElement>(".toolbar");
const status = document.querySelector<HTMLElement>("#status");
const hint = document.querySelector<HTMLElement>("#mobileCanvasHint");

let connectMode = false;
let hintTimer: number | null = null;
let edgeEditorHome: Comment | null = null;

function showHint(message: string, holdMs = 2200): void {
  if (!hint || !isMobileLayout()) return;
  hint.textContent = message;
  hint.classList.add("visible");
  if (hintTimer !== null) window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => hint.classList.remove("visible"), holdMs);
}

function setSheetExpanded(expanded: boolean): void {
  if (!algorithmPanel || !sheetToggle) return;
  algorithmPanel.classList.toggle("mobile-collapsed", !expanded);
  sheetToggle.setAttribute("aria-expanded", String(expanded));
  sheetToggle.lastChild && (sheetToggle.lastChild.textContent = expanded ? " Hide Algorithm Details" : " Algorithm Controls");
}

function setFullscreen(enabled: boolean): void {
  document.body.classList.toggle("mobile-graph-fullscreen", enabled);
  fullscreenButton?.setAttribute("aria-pressed", String(enabled));
  requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
  if (enabled) showHint("Full-screen graph: drag vertices, pinch/drag the view, or tap Show Controls.", 3200);
}

function setConnectMode(enabled: boolean): void {
  connectMode = enabled;
  if (!connectModeButton) return;
  connectModeButton.setAttribute("aria-pressed", String(enabled));
  connectModeButton.textContent = enabled ? "Connecting…" : "Connect Mode";
  if (enabled) showHint("Connect Mode: tap the first vertex, then tap the second.", 3500);
}

function selectionCountFromStatus(): number {
  const text = status?.textContent ?? "";
  const match = text.match(/^Selected vertices:\s*(.+?)\.\s*(?:Shift-click|$)/i);
  if (!match) return 0;
  return match[1].split(",").map(part => part.trim()).filter(Boolean).length;
}

function moveEdgeEditorForMobile(): void {
  if (!edgeEditor || !algorithmPanel || !toolbar) return;

  if (isMobileLayout()) {
    if (!edgeEditorHome) {
      edgeEditorHome = document.createComment("edge-editor-home");
      edgeEditor.parentNode?.insertBefore(edgeEditorHome, edgeEditor);
    }
    if (edgeEditor.parentElement !== algorithmPanel) {
      algorithmPanel.insertBefore(edgeEditor, algorithmPanel.children[1] ?? null);
    }
  } else if (edgeEditorHome?.parentNode) {
    edgeEditorHome.parentNode.insertBefore(edgeEditor, edgeEditorHome);
    edgeEditorHome.remove();
    edgeEditorHome = null;
  }
}

sheetToggle?.addEventListener("click", () => {
  const expanded = sheetToggle.getAttribute("aria-expanded") === "true";
  setSheetExpanded(!expanded);
});

fullscreenButton?.addEventListener("click", () => setFullscreen(true));
exitFullscreenButton?.addEventListener("click", () => setFullscreen(false));

connectModeButton?.addEventListener("click", () => {
  setConnectMode(!connectMode);
});

canvas?.addEventListener("pointerup", () => {
  if (!connectMode || !isMobileLayout()) return;

  window.setTimeout(() => {
    const count = selectionCountFromStatus();
    if (count >= 2) {
      addEdgeButton?.click();
      setConnectMode(false);
      showHint("Vertices connected.", 1800);
    } else if (count === 1) {
      showHint("First vertex selected. Tap the second vertex.", 2400);
    }
  }, 0);
}, { passive: true });

status && new MutationObserver(() => {
  if (!isMobileLayout()) return;
  const text = status.textContent ?? "";
  if (/Edge selected/i.test(text)) {
    setSheetExpanded(true);
    showHint("Edge selected. Edit its weight in the controls below.", 2500);
  }
}).observe(status, { childList: true, characterData: true, subtree: true });

const mobileMedia = window.matchMedia("(max-width: 820px)");
mobileMedia.addEventListener("change", () => {
  if (!isMobileLayout()) {
    document.body.classList.remove("mobile-graph-fullscreen");
    setConnectMode(false);
  } else {
    setSheetExpanded(false);
  }
  moveEdgeEditorForMobile();
  window.dispatchEvent(new Event("resize"));
});

window.addEventListener("orientationchange", () => {
  window.setTimeout(() => window.dispatchEvent(new Event("resize")), 150);
});

moveEdgeEditorForMobile();
if (isMobileLayout()) {
  setSheetExpanded(false);
  showHint("Tap vertices to select. Drag to move. Use Connect Mode to join two vertices.", 3600);
}
