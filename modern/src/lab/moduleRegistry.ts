export type LabModuleCleanup = () => void;

export interface RegisteredLabModule {
  id: string;
  icon: string;
  title: string;
  description: string;
  featured?: boolean;
  replacesLegacyId?: string;
  render: (host: HTMLElement) => void | LabModuleCleanup;
}

export interface LabModuleRenderResult {
  cleanup: LabModuleCleanup | null;
  error: Error | null;
}

export interface LabModuleCleanupResult {
  error: Error | null;
}

type RegistryListener = () => void;

const modules = new Map<string, RegisteredLabModule>();
const listeners = new Set<RegistryListener>();

function notify(): void {
  listeners.forEach(listener => listener());
}

function normalizeError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function registerLabModule(module: RegisteredLabModule): void {
  const id = module.id.trim();
  if (!id) throw new Error("Lab module id cannot be empty.");
  if (modules.has(id)) throw new Error(`Lab module '${id}' is already registered.`);
  modules.set(id, { ...module, id });
  notify();
}

export function listRegisteredLabModules(): RegisteredLabModule[] {
  return [...modules.values()];
}

export function makeIdempotentLabCleanup(cleanup: LabModuleCleanup): LabModuleCleanup {
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
}

export function runLabModuleCleanup(cleanup: LabModuleCleanup | null): LabModuleCleanupResult {
  if (!cleanup) return { error: null };
  try {
    cleanup();
    return { error: null };
  } catch (cause) {
    return { error: normalizeError(cause) };
  }
}

export function renderRegisteredLabModule(module: RegisteredLabModule, host: HTMLElement): LabModuleRenderResult {
  try {
    const cleanup = module.render(host);
    return {
      cleanup: cleanup ? makeIdempotentLabCleanup(cleanup) : null,
      error: null
    };
  } catch (cause) {
    return { cleanup: null, error: normalizeError(cause) };
  }
}

export function subscribeToLabModules(listener: RegistryListener): LabModuleCleanup {
  listeners.add(listener);
  return makeIdempotentLabCleanup(() => listeners.delete(listener));
}

export function clearLabModulesForTests(): void {
  modules.clear();
  listeners.clear();
}
