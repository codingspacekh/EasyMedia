// M18: which app the Animation mode panels (Layers, tools, stage, Properties, dialogs) work on.
// Animation mode's by default; Graphics mode puts its own app round them (EditorScope.svelte),
// with `still` set: one frame, so the timeline-only parts (keyframes, motion paths, morphs,
// one-click effects, buttons, sounds, stop motion) are not shown.
import { getContext, setContext } from 'svelte';
import type { AnimationApp } from '../../app/animation.ts';
import type { App } from '../../app/app.ts';

export interface EditorView {
  anim: AnimationApp;
  /** Graphics mode: a still image. */
  still: boolean;
  /** The PanelSlot ids its Layers and Properties panels use. */
  panels: {
    layers: 'animation.layers' | 'graphics.layers';
    properties: 'animation.properties' | 'graphics.properties';
  };
}

const KEY = Symbol('editor');

export function provideEditor(view: EditorView): void {
  setContext(KEY, view);
}

/**
 * The app the panel works on: Graphics mode's inside its scope, else Animation mode's. Called
 * while the component is made, with a getter for its `app` prop.
 */
export function editorOf(app: () => App): EditorView {
  const scoped = getContext<EditorView | undefined>(KEY);
  if (scoped) return scoped;
  return {
    get anim() {
      return app().animation;
    },
    still: false,
    panels: { layers: 'animation.layers', properties: 'animation.properties' },
  };
}
