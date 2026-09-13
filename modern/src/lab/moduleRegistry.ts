export type LabModuleCleanup = () => void;

export interface RegisteredLabModule {
  id: string;
  icon: string;
  title: string;
  description: string;
  featured?: boolean;
  render: (host: HTMLElement) => void | LabModuleCleanup;
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

export function subscribeToLabModules(listener: RegistryListener): LabModuleCleanup {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearLabModulesForTests(): void {
  modules.clear();
  listeners.clear();
}
