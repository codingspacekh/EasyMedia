// M6 exit gate: coursebook text and still tasks done through the real app's UI, checked on the
// exported files — plus the preview vs export text position check (≤ 2 px).
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { countPixels, grayFrame, measure, tinyFrame } from '../integration/helpers/measure.ts';
import { answerDialogs, launchApp, exportVideo, openTab } from './app.ts';
import { shot } from './audio.ts';

const FRAME = 1 / 30;
const BEE = 'clip_1080p30_10s.mp4'; // stand-in for 11.01 BeeFly.mov
const LAKE = 'lake_1080p30_20s.mp4'; // stand-in for BeeFlySlow (long enough for 3 s + 7 s of text)
const EAGLE = 'photo_3764x3092.jpg'; // same size as Fish_Eagle.jpg
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m6-'));
  const wanted = [BEE, LAKE, EAGLE];
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => wanted.includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function importAndAdd(page: Page, files: string[]) {
  await page.getByRole('button', { name: 'Import' }).click();
  for (const f of files) {
    await expect(page.getByText(f, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Add ${f} to the timeline` }).click();
  }
}
async function setTime(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}
async function setText(page: Page, text: string) {
  const box = page.getByLabel('Text', { exact: true });
  await box.fill(text);
  await box.blur();
}
async function setSize(page: Page, size: string) {
  const box = page.getByLabel('Size', { exact: true });
  await box.fill(size);
  await box.blur();
}
async function exportTo(page: Page, output: string) {
  await exportVideo(page, output, {}, 180_000);
}
/** Box around the opaque pixels of the preview's text canvases (project pixels). */
function previewTextBox(page: Page) {
  return page.evaluate(() => {
    let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
    // Captions on top; a title's words in its clip's layer.
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
      'canvas.text, canvas.words',
    )) {
      const { width: w, height: h } = canvas;
      const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3]! > 128) {
            box ??= { x0: x, y0: y, x1: x, y1: y };
            box.x0 = Math.min(box.x0, x);
            box.y0 = Math.min(box.y0, y);
            box.x1 = Math.max(box.x1, x);
            box.y1 = Math.max(box.y1, y);
          }
    }
    return box;
  });
}

test('Book A 11.02: two-line Courier title, size 80, centred, 3 s — preview matches export (≤ 2 px)', async () => {
  const { app, window: page, userData } = await launchApp();
  const output = join(dir, 'title.mp4');
  await answerDialogs(app, { exportTo: output });
  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'Did you know that bees are very important\nto our world?');
  await chooseFont(page, 'Courier Prime');
  await setSize(page, '80');
  await page.getByRole('button', { name: 'Align centre' }).click();
  await setTime(page, 'Duration', '3');
  await expect(page.locator('.inspector .len').first()).toHaveText('3.00 s');
  await exportTo(page, output);

  expect(Math.abs((await measure(output)).videoDuration - 3)).toBeLessThanOrEqual(FRAME + 0.001);
  const exported = (await grayFrame(output, 1.5)).brightBox()!;
  // Two centred lines of white words on black, in the middle of the frame.
  expect(exported.x0).toBeGreaterThan(100);
  expect(exported.x1).toBeLessThan(1820);
  expect(Math.abs((exported.x0 + exported.x1) / 2 - 960)).toBeLessThan(4);
  expect(exported.y1 - exported.y0).toBeGreaterThan(120); // two lines of 80 px text

  // The preview draws the same words in the same place (fonts load first, then it redraws).
  await expect
    .poll(async () => {
      const box = await previewTextBox(page);
      if (!box) return 999;
      return Math.max(
        Math.abs(box.x0 - exported.x0),
        Math.abs(box.y0 - exported.y0),
        Math.abs(box.x1 - exported.x1),
        Math.abs(box.y1 - exported.y1),
      );
    })
    .toBeLessThanOrEqual(2);

  // Deterministic: drawing the same title again gives a byte-identical picture.
  const textPictures = async () => {
    const folder = join(userData, 'text');
    const names = await readdir(folder);
    return Promise.all(names.map((n) => readFile(join(folder, n))));
  };
  const [first] = await textPictures();
  await answerDialogs(app, { exportTo: join(dir, 'title-again.mp4') });
  await exportTo(page, join(dir, 'title-again.mp4'));
  const [second] = await textPictures();
  expect(first!.length).toBeGreaterThan(1000);
  expect(Buffer.compare(first!, second!)).toBe(0);
  await app.close();
});

test('Book A 11.05: a black three-line Courier caption in the top-left corner of BeeFly', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'caption.mp4');
  await answerDialogs(app, { open: [join(dir, BEE)], exportTo: output });
  await importAndAdd(page, [BEE]);
  await page.getByRole('button', { name: 'Add caption' }).click();
  await setText(
    page,
    'Bees are very important pollinators\nfor fruits and vegetables.\nThey help them grow!',
  );
  await chooseFont(page, 'Courier Prime');
  await setSize(page, '60');
  await page.getByLabel('Colour', { exact: true }).fill('#000000');
  await page.getByRole('button', { name: 'Top left' }).click();
  await exportTo(page, output);

  const [made, source] = [await grayFrame(output, 2), await grayFrame(join(dir, BEE), 2)];
  // The words change the top-left corner of the picture and nothing in the bottom right.
  expect(made.changedIn(source, [96, 54, 960, 300])).toBeGreaterThan(5000);
  expect(made.changedIn(source, [1100, 700, 1900, 1060])).toBeLessThan(200);
  await app.close();
});

test('Book A 11.10: two texts with a smooth change between them, then a yellow 5 s end slide', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'bees-texts.mp4');
  await answerDialogs(app, { open: [join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [LAKE]);

  await page.getByRole('button', { name: 'Add subtitle' }).click();
  await setText(page, 'We need to take care of our bees.');
  await page.getByRole('checkbox', { name: 'Outline' }).check();
  await setTime(page, 'Duration', '3');
  await setTime(page, 'Text fade out', '0.5');

  await page.getByRole('button', { name: 'Add subtitle' }).click();
  await setText(
    page,
    'Without them we’ll lose products such as honey,\ncoffee and many fruits and vegetables.',
  );
  await page.getByRole('checkbox', { name: 'Outline' }).check();
  await setTime(page, 'Starts at', '3');
  await setTime(page, 'Duration', '7');
  await setTime(page, 'Text fade in', '0.5');

  await page.locator('[data-item]').first().click();
  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(
    page,
    'To find out more about bees visit the website\nwww.bumblebeeconservation.org',
  );
  await page.getByLabel('Colour', { exact: true }).fill('#ffff00');
  await setTime(page, 'Duration', '5');
  await exportTo(page, output);

  expect(Math.abs((await measure(output)).videoDuration - 25)).toBeLessThanOrEqual(FRAME + 0.001);
  const source = (t: number) => grayFrame(join(dir, LAKE), t);
  const lowerThird = [96, 860, 1824, 1030];
  const changed = async (t: number) =>
    (await grayFrame(output, t)).changedIn(await source(t), lowerThird);
  expect(await changed(1.5)).toBeGreaterThan(3000); // first text
  expect(await changed(6)).toBeGreaterThan(3000); // second text
  expect(await changed(15)).toBeLessThan(200); // no text after 10 s
  // The end slide: yellow words on black.
  // The end slide: yellow words on black (counted at full size; thin text vanishes when shrunk).
  const yellow = (r: number, g: number, b: number) => r > 180 && g > 180 && b < 90;
  expect(await countPixels(output, 22.5, yellow)).toBeGreaterThan(2000);
  expect(await countPixels(join(dir, LAKE), 2.5, yellow)).toBeLessThan(200);
  await app.close();
});

test('Book A 11.14: credits scroll over the still image at the end of the video', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'credits.mp4');
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, EAGLE)], exportTo: output });
  await importAndAdd(page, [BEE, EAGLE]);
  await page.getByRole('button', { name: 'Add credits' }).click();
  await setText(page, 'Made by\nA Student\n\nVideo: BeeFly\nMusic: none');
  await page.getByRole('checkbox', { name: 'Outline' }).check();
  await setTime(page, 'Starts at', '10');
  await setTime(page, 'Duration', '5');
  await exportTo(page, output);

  expect(Math.abs((await measure(output)).videoDuration - 15)).toBeLessThanOrEqual(FRAME + 0.001);
  // The still does not change, so any difference between two moments is the credits moving.
  const [early, middle, late] = [
    await grayFrame(output, 10.1),
    await grayFrame(output, 12.5),
    await grayFrame(output, 14.9),
  ];
  const middleBand = [0, 400, 1920, 700];
  expect(middle.changedIn(early, middleBand)).toBeGreaterThan(3000);
  expect(late.changedIn(early, middleBand)).toBeLessThan(500);
  await app.close();
});

test('Book B Task 11a: resize & crop Fish_Eagle to 1920 × 1080, dark blue 60 pt title flying in, 8 s', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'Task_11a.mp4');
  await answerDialogs(app, { open: [join(dir, EAGLE)], exportTo: output });
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('button', { name: `Resize and crop ${EAGLE}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Resize and crop image' });
  await expect(dialog).toContainText('1577 px');
  await dialog.getByRole('button', { name: 'Keep Bottom', exact: true }).click();
  await expect(dialog).toContainText('Removes 497 px from the top');
  await dialog.getByRole('button', { name: 'Save image' }).click();
  const cropped = EAGLE.replace('.jpg', '1.jpg');
  await expect(page.getByText(cropped, { exact: true })).toBeVisible();
  expect((await measure(join(dir, cropped))).width).toBe(1920);
  expect((await measure(join(dir, cropped))).height).toBe(1080);

  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'Lake Naivasha, Kenya');
  await setSize(page, '60');
  await page.getByLabel('Colour', { exact: true }).fill('#00008b');
  await page.getByLabel('Background', { exact: true }).selectOption('image');
  await page.getByLabel('Background picture').selectOption({ label: cropped });
  await page.getByLabel('Entrance').selectOption('fly-left');
  await setTime(page, 'Duration', '8');
  await exportTo(page, output);

  const m = await measure(output);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(Math.abs(m.videoDuration - 8)).toBeLessThanOrEqual(FRAME + 0.001);
  // The words fly in: at 0.1 s they are still off to the left; at 4 s they sit in the centre.
  const settled = await grayFrame(output, 4);
  const flying = await grayFrame(output, 0.1);
  const centre = [560, 480, 1360, 600];
  expect(settled.changedIn(flying, centre)).toBeGreaterThan(2000);
  await app.close();
});

test('Book B Activity 11a: 4:3 at 960 × 720, yellow 48 pt serif title over a picture, 6 s', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'Activity_11a.mp4');
  await answerDialogs(app, { open: [join(dir, EAGLE)], exportTo: output });
  await page.getByRole('button', { name: /16:9 · 1920 × 1080/ }).click();
  await page.getByRole('radio', { name: '4:3' }).check();
  await page.getByRole('radio', { name: '960 × 720' }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('button', { name: `Resize and crop ${EAGLE}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save image' }).click();
  // A numbered copy beside the original (Task 11a may already have made the first one).
  const copy = page.getByText(/^photo_3764x3092\d+\.jpg$/);
  await expect(copy).toBeVisible();
  const cropped = (await copy.textContent())!;
  expect((await measure(join(dir, cropped))).height).toBe(720);

  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'Diving in Cozumel, Mexico');
  await chooseFont(page, 'Noto Serif');
  await setSize(page, '48');
  await page.getByLabel('Colour', { exact: true }).fill('#ffff00');
  await page.getByLabel('Background', { exact: true }).selectOption('image');
  await page.getByLabel('Background picture').selectOption({ label: cropped });
  await page.getByLabel('Entrance').selectOption('fly-down');
  await setTime(page, 'Duration', '6');
  await exportTo(page, output);

  const m = await measure(output);
  expect([m.width, m.height]).toEqual([960, 720]);
  expect(Math.abs(m.videoDuration - 6)).toBeLessThanOrEqual(FRAME + 0.001);
  await app.close();
});

test('V11 choosing the part with the mouse: the saved picture is exactly the part shown', async () => {
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: [join(dir, EAGLE)] });
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('button', { name: `Resize and crop ${EAGLE}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Resize and crop image' });
  const pic = (await page.locator('.picture').boundingBox())!;
  // Draw a part on the picture, then move it.
  await page.mouse.move(pic.x + 20, pic.y + 15);
  await page.mouse.down();
  await page.mouse.move(pic.x + pic.width * 0.6, pic.y + 60, { steps: 10 });
  await page.mouse.up();
  const part = (await page.locator('.keep').boundingBox())!;
  await page.mouse.move(part.x + part.width / 2, part.y + part.height / 2);
  await page.mouse.down();
  await page.mouse.move(part.x + part.width / 2 + 40, part.y + part.height / 2 + 80, { steps: 10 });
  await page.mouse.up();

  const text = await dialog.innerText();
  const num = (re: RegExp) => Number(re.exec(text)?.[1] ?? 0);
  const [w, h] = [num(/Width\s+(\d+) px/), num(/Height\s+(\d+) px/)];
  const [top, left] = [num(/(\d+) px from the top/), num(/(\d+) px from the left/)];
  expect(w).toBeGreaterThan(1920); // a smaller part than the largest, so the picture is resized up

  const before = await page.getByText(/^photo_3764x3092\d+\.jpg$/).count();
  await dialog.getByRole('button', { name: 'Save image' }).click();
  await expect(page.getByText(/^photo_3764x3092\d+\.jpg$/)).toHaveCount(before + 1);
  const saved = (await page
    .getByText(/^photo_3764x3092\d+\.jpg$/)
    .last()
    .textContent())!;
  const m = await measure(join(dir, saved));
  expect([m.width, m.height]).toEqual([1920, 1080]);

  // Make the expected picture straight from the numbers the dialog showed, and compare.
  const expected = join(dir, 'expected-crop.png');
  await run(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-i', join(dir, EAGLE)],
    ...['-vf', `scale=${w}:${h}:flags=lanczos,crop=1920:1080:${left}:${top}`, '-y', expected],
  ]);
  const [a, b] = [await tinyFrame(join(dir, saved), 0), await tinyFrame(expected, 0)];
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 16; x++)
      a.at(x, y).forEach((v, i) => expect(Math.abs(v - b.at(x, y)[i]!)).toBeLessThan(12));
  await app.close();
});

/** X2: opens the font chooser and picks a font by its name. */
async function chooseFont(page: Page, name: string) {
  await page.getByRole('button', { name: /^Font:/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Font' })
    .getByRole('radio', { name, exact: true })
    .click();
}

/** Moves the playhead by clicking the timeline's ruler (40 px = 1 s until zoomed). */
async function seek(page: Page, seconds: number) {
  const ruler = page.locator('.timeline .ruler');
  const box = (await ruler.boundingBox())!;
  await page.mouse.click(box.x + seconds * 40 + 1, box.y + box.height / 2);
}

test('more choices: a Lobster title with the Neon look pops in; the preview matches the export mid-pop', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  const output = join(dir, 'pop.mp4');
  await answerDialogs(app, { exportTo: output });
  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'Bees!');
  await chooseFont(page, 'Lobster');
  await setSize(page, '160');
  await page
    .getByRole('group', { name: 'Text look' })
    .getByRole('button', { name: 'Neon' })
    .click();
  await page.getByLabel('Entrance', { exact: true }).selectOption('pop');
  await setTime(page, 'Duration', '3');
  await seek(page, 2);
  await shot(page, 'title-neon-lobster');
  await page.getByRole('button', { name: /^Font:/ }).click();
  await shot(page, 'font-chooser');
  await page.keyboard.press('Escape');
  await exportTo(page, output);

  // After the pop the words are full size; half way through it they are bigger (it overshoots).
  const settled = (await grayFrame(output, 2)).brightBox()!;
  const popping = (await grayFrame(output, 0.6)).brightBox()!;
  expect(popping.x1 - popping.x0).toBeGreaterThan(settled.x1 - settled.x0);
  // The preview pops the same way, around the same middle.
  await seek(page, 0.6);
  await expect
    .poll(async () => {
      const box = await previewTextBox(page);
      if (!box) return 999;
      return Math.abs(box.x1 - box.x0 - (popping.x1 - popping.x0));
    })
    .toBeLessThanOrEqual(24); // the export's box is of bright pixels, the preview's of opaque ones
  await app.close();
});

test('more choices: two titles joined by a clock wipe chosen from the transition tiles', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  const output = join(dir, 'clock.mp4');
  await answerDialogs(app, { exportTo: output });
  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'One');
  await setTime(page, 'Duration', '3');
  await page.getByRole('button', { name: 'Add title' }).click();
  await setText(page, 'Two');
  await setTime(page, 'Duration', '3');
  await openTab(page, 'Effects');
  const picker = page.getByRole('radiogroup', { name: 'Transition' });
  await picker.getByRole('radio', { name: 'Clock wipe' }).hover();
  await shot(page, 'transition-tiles');
  await picker.getByRole('radio', { name: 'Clock wipe' }).click();
  await expect(picker.getByRole('radio', { name: 'Clock wipe' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await seek(page, 2.5);
  // Half way through the wipe, the next title's words are coming in with their clip.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>('.incoming canvas.words');
        if (!canvas) return 0;
        const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
        let n = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 128) n++;
        return n;
      }),
    )
    .toBeGreaterThan(100);
  await shot(page, 'transition-preview');
  await exportTo(page, output);
  // A 1 s transition overlaps the titles: 3 + 3 − 1 s.
  expect(Math.abs((await measure(output)).videoDuration - 5)).toBeLessThanOrEqual(FRAME + 0.001);
  await app.close();
});
