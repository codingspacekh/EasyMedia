import { describe, expect, it } from 'vitest';
import { detectHardwareEncoder, encoderTester } from '../../../src/main/ffmpeg/hardware.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';

describe('hardware encoder on this machine', () => {
  const tryEncoder = encoderTester(bundledFfmpeg().ffmpeg);

  it('the software encoder always works; a made-up one never does', async () => {
    expect(await tryEncoder('libx264')).toBe(true);
    expect(await tryEncoder('no_such_encoder')).toBe(false);
  });

  it('detection returns a working hardware encoder or null (then libx264 is used)', async () => {
    const found = await detectHardwareEncoder(process.platform, tryEncoder);
    if (found) expect(await tryEncoder(found)).toBe(true);
    else expect(found).toBeNull();
    console.info(
      `Hardware encoder on ${process.platform}-${process.arch}: ${found ?? 'none (libx264)'}`,
    );
  });

  // Regression: detection used a 256×256 test frame, which VideoToolbox rejects, so a working
  // hardware encoder was reported as missing on macOS.
  it('finds the same encoder that can really encode HD video', async () => {
    const candidates: Record<string, string[]> = {
      darwin: ['h264_videotoolbox'],
      win32: ['h264_nvenc', 'h264_qsv', 'h264_amf'],
    };
    let expected: string | null = null;
    for (const encoder of candidates[process.platform] ?? []) {
      const ok = await run(bundledFfmpeg().ffmpeg, [
        ...[
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'testsrc2=size=1280x720:rate=30:duration=1',
        ],
        ...['-c:v', encoder, '-f', 'null', '-'],
      ]).then(
        () => true,
        () => false,
      );
      if (ok) {
        expected = encoder;
        break;
      }
    }
    expect(await detectHardwareEncoder(process.platform, tryEncoder)).toBe(expected);
  });
});
