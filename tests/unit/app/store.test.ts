import { describe, expect, it } from 'vitest';
import { createStore } from '../../../src/app/store.ts';

describe('P3 store: one place for app state, Svelte-compatible', () => {
  it('tells subscribers the current value at once and after every change', () => {
    const store = createStore({ n: 1 });
    const seen: number[] = [];
    const stop = store.subscribe((s) => seen.push(s.n));
    store.update((s) => ({ n: s.n + 1 }));
    store.set({ n: 10 });
    stop();
    store.set({ n: 99 });
    expect(seen).toEqual([1, 2, 10]);
    expect(store.get()).toEqual({ n: 99 });
  });

  it('does not notify when the value is unchanged', () => {
    const store = createStore({ n: 1 });
    let calls = 0;
    store.subscribe(() => calls++);
    store.update((s) => s);
    expect(calls).toBe(1);
  });
});
