// V8 pan & zoom: where the view is at a moment, and the Movie Maker-style presets. The export
// writes the same rule as a zoompan expression (render/compile.ts); the preview uses this.
import type { Seconds } from '../model/time.ts';
import type { PanZoom, PanZoomFrame } from '../model/types.ts';

export function panZoomAt(pz: PanZoom, t: Seconds, length: Seconds): PanZoomFrame {
  const start = pz.start ?? 0;
  const end = pz.end ?? length;
  const p = Math.min(1, Math.max(0, (t - start) / (end - start)));
  const lerp = (a: number, b: number) => a + (b - a) * p;
  const zoom = lerp(pz.from.zoom, pz.to.zoom);
  // The view (1/zoom of the picture) never leaves the picture.
  const half = 0.5 / zoom;
  const inside = (c: number) => Math.min(1 - half, Math.max(half, c));
  return { zoom, x: inside(lerp(pz.from.x, pz.to.x)), y: inside(lerp(pz.from.y, pz.to.y)) };
}

export interface PanZoomPreset {
  id: string;
  label: string;
  from: PanZoomFrame;
  to: PanZoomFrame;
}

const at = (zoom: number, x = 0.5, y = 0.5): PanZoomFrame => ({ zoom, x, y });
const IN = 1.5;

export const PAN_ZOOM_PRESETS: readonly PanZoomPreset[] = [
  { id: 'zoom-in', label: 'Zoom in', from: at(1), to: at(IN) },
  { id: 'zoom-in-left', label: 'Zoom in left', from: at(1), to: at(IN, 0) },
  { id: 'zoom-in-right', label: 'Zoom in right', from: at(1), to: at(IN, 1) },
  { id: 'zoom-in-top', label: 'Zoom in top', from: at(1), to: at(IN, 0.5, 0) },
  { id: 'zoom-in-bottom', label: 'Zoom in bottom', from: at(1), to: at(IN, 0.5, 1) },
  { id: 'zoom-out', label: 'Zoom out', from: at(IN), to: at(1) },
  { id: 'pan-left-right', label: 'Pan left → right', from: at(IN, 0), to: at(IN, 1) },
  { id: 'pan-right-left', label: 'Pan right → left', from: at(IN, 1), to: at(IN, 0) },
  { id: 'pan-up', label: 'Pan up', from: at(IN, 0.5, 1), to: at(IN, 0.5, 0) },
  { id: 'pan-down', label: 'Pan down', from: at(IN, 0.5, 0), to: at(IN, 0.5, 1) },
];
