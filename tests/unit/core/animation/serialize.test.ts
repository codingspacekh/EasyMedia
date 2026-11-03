// M13 / AN16: .mvea files — JSON with a schema version, picture paths relative to the file (X1),
// refusing files that are not animations, upgrading old versions.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createPicture,
  createStar,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { addDrawing, stopMotion, toFrameByFrame } from '../../../../src/core/animation/frames.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import {
  animationFromDisk,
  animationToDisk,
  ANIMATION_DAMAGED,
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { createProject } from '../../../../src/core/model/factory.ts';
import { serializeProject } from '../../../../src/core/project/serialize.ts';

const picture = { id: 'p', path: 'C:/Users/x/Task5.jpg', width: 640, height: 360 };

function sample() {
  let doc = createAnimation({ name: 'Chapter07_Task1_1' });
  doc = { ...doc, pictures: [picture], guides: { x: [250], y: [] } };
  doc = addObject(doc, doc.layers[0]!.id, createStar({ x: 128, y: 102, width: 135, height: 135 }));
  doc = addObject(doc, doc.layers[0]!.id, createText('Task 1', { x: 193, y: 73, size: 64 }));
  doc = addObject(doc, doc.layers[0]!.id, createPicture(picture, { x: 0, y: 0 }));
  return doc;
}

describe('.mvea files (AN16)', () => {
  it('round-trips an animation through text', () => {
    const doc = sample();
    const text = serializeAnimation(doc);
    expect(text.startsWith('{\n  "schemaVersion": 4,')).toBe(true);
    expect(deserializeAnimation(text)).toEqual(doc);
  });

  it('AN21 keeps a transparent stage', () => {
    const doc = { ...sample(), stage: { ...sample().stage, background: 'none' } };
    expect(deserializeAnimation(serializeAnimation(doc)).stage.background).toBe('none');
  });

  it('X1 stores picture paths relative to the file and restores them', () => {
    const onDisk = animationToDisk(sample(), 'C:\\Users\\x');
    expect(onDisk.pictures[0]!.path).toBe('Task5.jpg');
    expect(animationFromDisk(onDisk, 'C:/Users/x').pictures[0]!.path).toBe('C:/Users/x/Task5.jpg');
    const other = animationToDisk(sample(), '/Users/x/Animations');
    expect(other.pictures[0]!.path).toBe('C:/Users/x/Task5.jpg');
  });

  it('refuses a video project, random JSON, a cut-off file and nonsense', () => {
    expect(() => deserializeAnimation(serializeProject(createProject({ name: 'v' })))).toThrow(
      ANIMATION_DAMAGED,
    );
    expect(() => deserializeAnimation('{"a":1}')).toThrow(ANIMATION_DAMAGED);
    expect(() => deserializeAnimation(serializeAnimation(sample()).slice(0, 200))).toThrow(
      ANIMATION_DAMAGED,
    );
    expect(() => deserializeAnimation('hello')).toThrow(ANIMATION_DAMAGED);
    expect(ANIMATION_DAMAGED).toMatch(/not a OneEditor animation/);
  });

  it('refuses a file from a newer version of the app', () => {
    const text = serializeAnimation(sample()).replace('"schemaVersion": 4', '"schemaVersion": 99');
    expect(() => deserializeAnimation(text)).toThrow(/newer version/);
  });

  it('refuses an object of an unknown kind or without its numbers', () => {
    const doc = sample();
    const broken = JSON.parse(serializeAnimation(doc));
    broken.layers[0].objects[0].kind = 'blob';
    expect(() => deserializeAnimation(JSON.stringify(broken))).toThrow(ANIMATION_DAMAGED);
    const noX = JSON.parse(serializeAnimation(doc));
    delete noX.layers[0].objects[1].x;
    expect(() => deserializeAnimation(JSON.stringify(noX))).toThrow(ANIMATION_DAMAGED);
  });

  it('AN14: keeps stop motion and frame-by-frame layers, and refuses damaged ones', () => {
    let doc = sample();
    const shots = [picture, { ...picture, id: 'q', path: 'C:/Users/x/Task6.jpg' }];
    doc = { ...doc, pictures: shots };
    doc = addObject(doc, doc.layers[0]!.id, stopMotion(shots, 12, doc.stage));
    doc = { ...doc, layers: [addDrawing(toFrameByFrame(doc.layers[0]!), 6, 'copy')] };
    expect(deserializeAnimation(serializeAnimation(doc))).toEqual(doc);
    const badLayer = JSON.parse(serializeAnimation(doc));
    badLayer.layers[0].drawings = ['six'];
    expect(() => deserializeAnimation(JSON.stringify(badLayer))).toThrow(ANIMATION_DAMAGED);
    const badObject = JSON.parse(serializeAnimation(doc));
    badObject.layers[0].objects[0].drawing = 'first';
    expect(() => deserializeAnimation(JSON.stringify(badObject))).toThrow(ANIMATION_DAMAGED);
  });
});
