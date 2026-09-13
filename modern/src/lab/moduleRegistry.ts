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

type RegistryListener = () => void;

const modules = new Map<string, RegisteredLabModule>();
const listeners = new Set<RegistryListener>();

function notify(): void {
  listeners.forEach(listener => listener());
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

export function renderRegisteredLabModule(module: RegisteredLabModule, host: HTMLElement): LabModuleRenderResult {
  try {
    return { cleanup: module.render(host) ?? null, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    return { cleanup: null, error };
  }
}

export function subscribeToLabModules(listener: RegistryListener): LabModuleCleanup {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearLabModulesForTests(): void {
  modules.clear();
  listeners.clear();
}
