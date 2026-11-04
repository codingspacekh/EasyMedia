// AN22 (O/N/25 Apple): the frame at the playhead saved as an SVG picture — vector shapes drawn by
// the same drawStage as the stage, through a canvas that writes SVG instead of pixels.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createButton,
  createEllipse,
  createGroup,
  createLayer,
  createPicture,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import type { AnimationDoc, AnimObject } from '../../../../src/core/animation/types.ts';

function stageWith(objects: AnimObject[], background = '#808080'): AnimationDoc {
  const doc = createAnimation({ name: 'Apple' });
  return {
    ...doc,
    stage: { ...doc.stage, width: 600, height: 400, background },
    layers: [createLayer('Layer 1', { objects })],
  };
}
const red = { kind: 'solid' as const, colour: '#B40000' };
const plain = (o: AnimObject): AnimObject => ({ ...o, stroke: undefined, fill: red });

describe('AN22 SVG picture of a frame', () => {
  it('is an SVG of the stage size, with the stage colour, then each shape as a path', () => {
    const svg = stageSvg(stageWith([plain(createRect({ x: 10, y: 20, width: 100, height: 50 }))]));
    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="600" height="400" viewBox="0 0 600 400">/,
    );
    expect(svg).toContain('<rect x="0" y="0" width="600" height="400" fill="#808080"/>');
    expect(svg).toContain('<path d="M10 20L110 20L110 70L10 70Z" fill="#B40000"/>');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('AN21 a transparent stage has no background', () => {
    const svg = stageSvg(stageWith([plain(createRect({ x: 0, y: 0 }))], 'none'));
    expect(svg).not.toContain('<rect');
  });

  it('an ellipse is drawn with arcs; a turned shape is turned about its centre', () => {
    const svg = stageSvg(
      stageWith([
        plain(createEllipse({ x: 0, y: 0, width: 300, height: 300 })),
        { ...plain(createRect({ x: 100, y: 100, width: 100, height: 50 })), rotation: 90 },
      ]),
    );
    expect(svg).toMatch(/<path d="M300 150A150 150 0 1 1 0 150A150 150 0 1 1 300 150Z?"/);
    // 100 × 50 turned 90° about (150, 125): its corners are now at x 125–175, y 75–175.
    expect(svg).toContain('<path d="M175 75L175 175L125 175L125 75Z" fill="#B40000"/>');
  });

  it('a see-through group is one <g> with the opacity; its parts have none of their own', () => {
    const cloud = {
      ...createGroup([
        plain(createEllipse({ x: 100, y: 100, width: 80, height: 80 })),
        plain(createEllipse({ x: 140, y: 100, width: 80, height: 80 })),
      ]),
      opacity: 50,
    };
    const svg = stageSvg(stageWith([cloud]));
    const group = /<g opacity="0\.5">([\s\S]*?)<\/g>/.exec(svg);
    expect(group).not.toBeNull();
    expect(group![1]!.match(/<path /g)).toHaveLength(2);
    expect(group![1]).not.toContain('opacity=');
  });

  it('gradients, outlines (dashed) and opacity', () => {
    const svg = stageSvg(
      stageWith([
        {
          ...createRect({ x: 0, y: 0, width: 200, height: 100 }),
          fill: { kind: 'linear', from: '#00ff00', to: '#004400', angle: 0 },
          stroke: { colour: '#5a3a1a', width: 4, dash: 'dashed' },
          opacity: 50,
        },
      ]),
    );
    expect(svg).toMatch(
      /<linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="200" y2="50"><stop offset="0" stop-color="#00ff00"\/><stop offset="1" stop-color="#004400"\/><\/linearGradient>/,
    );
    expect(svg).toContain('fill="url(#g1)" opacity="0.5"');
    expect(svg).toMatch(
      /stroke="#5a3a1a" stroke-width="4" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="12 8"/,
    );
  });

  it('text stays text, in its font, with special characters escaped', () => {
    const svg = stageSvg(
      stageWith([{ ...createText('Tom & <Jerry>', { x: 10, y: 20, size: 64 }), bold: true }]),
    );
    expect(svg).toMatch(
      /<text x="[-\d.]+" y="[-\d.]+" font-family="Inter" font-size="64" font-weight="700" text-anchor="start" dominant-baseline="text-before-edge" xml:space="preserve" fill="#000000"( transform="[^"]*")?>Tom &amp; &lt;Jerry&gt;<\/text>/,
    );
  });

  it('a picture is put in as data, at its place and size', () => {
    const picture = { id: 'p1', path: '/m/leaf.png', width: 40, height: 30 };
    const doc = { ...stageWith([createPicture(picture, { x: 5, y: 6 })]), pictures: [picture] };
    const svg = stageSvg(doc, 0, { p1: 'data:image/png;base64,AAAA' });
    expect(svg).toMatch(
      /<image href="data:image\/png;base64,AAAA" x="[-\d.]+" y="[-\d.]+" width="40" height="30" preserveAspectRatio="none" transform="matrix\(1 0 0 1 25 21\)"\/>/,
    );
  });

  it('AN12 a mask layer clips the layer beneath it', () => {
    const doc = stageWith([]);
    const svg = stageSvg({
      ...doc,
      layers: [
        createLayer('Cloud', {
          objects: [plain(createRect({ x: 0, y: 0, width: 600, height: 400 }))],
        }),
        createLayer('Mask', {
          mask: true,
          objects: [plain(createRect({ x: 100, y: 100, width: 50, height: 50 }))],
        }),
      ],
    });
    expect(svg).toContain(
      '<clipPath id="c1"><path d="M100 100L150 100L150 150L100 150Z"/></clipPath>',
    );
    expect(svg).toMatch(
      /<g clip-path="url\(#c1\)">\n<path d="M0 0L600 0L600 400L0 400Z"[^>]*\/>\n<\/g>/,
    );
  });

  it('a radial gradient, outlined italic text and a button (its label in the middle)', () => {
    const svg = stageSvg(
      stageWith([
        {
          ...createEllipse({ x: 0, y: 0, width: 100, height: 60 }),
          fill: { kind: 'radial', from: '#ffffff', to: '#B40000' },
        },
        {
          ...createText('Bite', { x: 10, y: 200, size: 40 }),
          italic: true,
          stroke: { colour: '#000000', width: 2, dash: 'dotted' },
        },
        { ...createButton('pause', { x: 300, y: 300 }), rotation: 45 },
      ]),
    );
    expect(svg).toMatch(
      /<radialGradient id="g1" gradientUnits="userSpaceOnUse" cx="50" cy="30" r="50">/,
    );
    expect(svg).toMatch(
      /<text [^>]*font-style="italic"[^>]*fill="none" stroke="#000000"[^>]*>Bite<\/text>/,
    );
    expect(svg).toMatch(
      /<text [^>]*dominant-baseline="central"[^>]*transform="matrix\(0\.707 0\.707 -0\.707 0\.707 [\d.]+ [\d.]+\)">Pause<\/text>/,
    );
  });

  it('a picture that could not be read is the dashed box the stage shows', () => {
    const picture = { id: 'p1', path: '/m/leaf.png', width: 40, height: 30 };
    const doc = { ...stageWith([createPicture(picture, { x: 5, y: 6 })]), pictures: [picture] };
    const svg = stageSvg(doc);
    expect(svg).not.toContain('<image');
    expect(svg).toMatch(
      /<path d="M5 6L45 6L45 36L5 36Z" fill="none" stroke="#9aa4b2" stroke-width="1"[^>]*stroke-dasharray="4 4"\/>/,
    );
  });
});
