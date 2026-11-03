// N16: the editors' panels — each can be resized by its edge and shown or hidden. The layout is a
// plain value (sizes and hidden panels), changed by pure functions and saved in the preferences,
// so it comes back after a restart. A new panel is one entry in PANELS.
import type { PreferencesStore } from './preferences.ts';
import { createStore, type Store } from './store.ts';

export type Editor = 'Video' | 'Audio' | 'Animation';

export interface PanelSpec {
  id: string;
  editor: Editor;
  /** What the panel is called on its edge's buttons ("Hide the Layers panel"). */
  label: string;
  /** The side of the editor it sits on; its size is a width (left, right) or a height (bottom). */
  edge: 'left' | 'right' | 'bottom';
  /** Default, smallest and largest size in px. */
  size: number;
  min: number;
  max: number;
}

const spec = <const T extends PanelSpec>(s: T): T => s;

export const PANELS = {
  'video.bin': spec({
    id: 'video.bin',
    editor: 'Video',
    label: 'Media bin',
    edge: 'left',
    size: 264,
    min: 200,
    max: 480,
  }),
  'video.inspector': spec({
    id: 'video.inspector',
    editor: 'Video',
    label: 'Inspector',
    edge: 'right',
    size: 332,
    min: 280,
    max: 520,
  }),
  'video.timeline': spec({
    id: 'video.timeline',
    editor: 'Video',
    label: 'Timeline',
    edge: 'bottom',
    size: 300,
    min: 150,
    max: 600,
  }),
  'audio.side': spec({
    id: 'audio.side',
    editor: 'Audio',
    label: 'Selection panel',
    edge: 'right',
    size: 280,
    min: 220,
    max: 460,
  }),
  'animation.layers': spec({
    id: 'animation.layers',
    editor: 'Animation',
    label: 'Layers',
    edge: 'left',
    size: 230,
    min: 180,
    max: 420,
  }),
  'animation.properties': spec({
    id: 'animation.properties',
    editor: 'Animation',
    label: 'Properties',
    edge: 'right',
    size: 304,
    min: 260,
    max: 460,
  }),
  // The timeline's rows area (its bar sits above it and may wrap on a small window).
  'animation.timeline': spec({
    id: 'animation.timeline',
    editor: 'Animation',
    label: 'Timeline',
    edge: 'bottom',
    size: 152,
    min: 90,
    max: 520,
  }),
} as const satisfies Record<string, PanelSpec>;

export type PanelId = keyof typeof PANELS;

export interface Layout {
  /** Sizes the student chose; a panel not listed has its default size. */
  sizes: Partial<Record<PanelId, number>>;
  hidden: PanelId[];
}

export const DEFAULT_LAYOUT: Layout = { sizes: {}, hidden: [] };

const isPanel = (id: unknown): id is PanelId => typeof id === 'string' && id in PANELS;
const clamp = (id: PanelId, size: number) =>
  Math.round(Math.min(PANELS[id].max, Math.max(PANELS[id].min, size)));

/** The editor's panels, left, right, then bottom. */
export const panelsOf = (editor: Editor): (PanelSpec & { id: PanelId })[] =>
  (Object.values(PANELS) as (PanelSpec & { id: PanelId })[])
    .filter((p) => p.editor === editor)
    .sort(
      (a, b) =>
        ['left', 'right', 'bottom'].indexOf(a.edge) - ['left', 'right', 'bottom'].indexOf(b.edge),
    );

export const sizeOf = (layout: Layout, id: PanelId): number => layout.sizes[id] ?? PANELS[id].size;

export const isShown = (layout: Layout, id: PanelId): boolean => !layout.hidden.includes(id);

export const resized = (layout: Layout, id: PanelId, size: number): Layout => ({
  ...layout,
  sizes: { ...layout.sizes, [id]: clamp(id, size) },
});

export const toggled = (layout: Layout, id: PanelId): Layout => ({
  ...layout,
  hidden: isShown(layout, id) ? [...layout.hidden, id] : layout.hidden.filter((h) => h !== id),
});

/** A saved layout, checked: unknown panels and values that are not sizes are left out. */
export function parseLayout(value: unknown): Layout {
  if (typeof value !== 'object' || value === null) return DEFAULT_LAYOUT;
  const v = value as { sizes?: unknown; hidden?: unknown };
  const sizes: Layout['sizes'] = {};
  if (typeof v.sizes === 'object' && v.sizes !== null)
    for (const [id, size] of Object.entries(v.sizes))
      if (isPanel(id) && typeof size === 'number' && Number.isFinite(size))
        sizes[id] = clamp(id, size);
  const hidden = Array.isArray(v.hidden) ? v.hidden.filter(isPanel) : [];
  return { sizes, hidden };
}

/** The layout as the app keeps it: a store, loaded from and saved to the preferences. */
export function createLayoutApp(preferences: PreferencesStore) {
  const store: Store<Layout> = createStore<Layout>(DEFAULT_LAYOUT);
  const save = (layout: Layout) => {
    store.set(layout);
    return preferences.update({ layout });
  };
  return {
    store,
    async load(): Promise<void> {
      store.set(parseLayout((await preferences.read()).layout));
    },
    resize: (id: PanelId, size: number) => save(resized(store.get(), id, size)),
    toggle: (id: PanelId) => save(toggled(store.get(), id)),
    /** View ▸ Left panel / Right panel / Timeline: the editor's panel on that edge. */
    toggleEdge(editor: Editor, edge: PanelSpec['edge']): Promise<void> {
      const panel = panelsOf(editor).find((p) => p.edge === edge);
      return panel ? save(toggled(store.get(), panel.id)) : Promise.resolve();
    },
    reset: () => save(DEFAULT_LAYOUT),
  };
}

export type LayoutApp = ReturnType<typeof createLayoutApp>;
