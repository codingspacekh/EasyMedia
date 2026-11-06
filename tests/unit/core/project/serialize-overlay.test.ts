// V20 and P1: pictures and videos over the video are saved with the project, only when there are
// some, so a project without them still opens in versions before 1.5.
import { describe, expect, it } from 'vitest';
import { ProjectFileError } from '../../../../src/core/model/errors.ts';
import { createMediaAsset, createProject } from '../../../../src/core/model/factory.ts';
import { createOverlayItem } from '../../../../src/core/model/overlay.ts';
import type { OverlayItem, Project } from '../../../../src/core/model/types.ts';
import { deserializeProject, serializeProject } from '../../../../src/core/project/serialize.ts';

const logo = createMediaAsset({ id: 'logo', kind: 'image', path: 'Logo.png' });
const clip2 = createMediaAsset({ id: 'clip2', kind: 'video', path: 'Clip2.mp4', duration: 8 });

function withOverlay(): Project {
  const p = createProject({ name: 'Overlay' });
  return {
    ...p,
    media: [logo, clip2],
    timeline: {
      ...p.timeline,
      overlay: [
        { ...createOverlayItem(logo, 0, { id: 'o', duration: 30 }), opacity: 0.8, fadeIn: 1 },
        { ...createOverlayItem(clip2, 30, { id: 'p' }), muted: false, volume: 0.5 } as OverlayItem,
      ],
    },
  };
}

describe('V20 saving pictures and videos over the video (P1)', () => {
  it('V20: saved and opened again exactly', () => {
    const p = withOverlay();
    expect(deserializeProject(serializeProject(p))).toEqual(p);
  });

  it('V20: a project without them has no overlay in its file (versions before 1.5 open it)', () => {
    expect(serializeProject(createProject({ name: 'Plain' }))).not.toContain('overlay');
    const opened = deserializeProject(serializeProject(createProject({ name: 'Plain' })));
    expect(opened.timeline.overlay).toBeUndefined();
  });

  it.each([
    ['not a list', { overlay: {} }],
    ['an unknown kind', { overlay: [{ ...withOverlay().timeline.overlay![0], type: 'sound' }] }],
    ['no start', { overlay: [{ ...withOverlay().timeline.overlay![0], start: 'soon' }] }],
    ['no width', { overlay: [{ ...withOverlay().timeline.overlay![0], widthPercent: null }] }],
    ['a bad fade', { overlay: [{ ...withOverlay().timeline.overlay![0], fadeIn: 'slow' }] }],
    ['a video without trim', { overlay: [{ ...withOverlay().timeline.overlay![1], in: null }] }],
    ['a video without muted', { overlay: [{ ...withOverlay().timeline.overlay![1], muted: 1 }] }],
  ])('V20: refuses a damaged file: %s', (_, change) => {
    const p = withOverlay();
    const text = JSON.stringify({ ...p, timeline: { ...p.timeline, ...change } });
    expect(() => deserializeProject(text)).toThrow(ProjectFileError);
  });
});
