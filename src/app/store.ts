// A tiny observable store (P3): one place for app state. Its shape matches Svelte's store
// contract, so components can read it with $store.
export interface Store<T> {
  get(): T;
  set(value: T): void;
  update(change: (value: T) => T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  const set = (next: T) => {
    if (next === value) return;
    value = next;
    listeners.forEach((l) => l(value));
  };
  return {
    get: () => value,
    set,
    update: (change) => set(change(value)),
    subscribe(listener) {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
  };
}
