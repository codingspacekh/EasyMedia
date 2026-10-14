// Picks a hardware H.264 encoder when the computer has one that works, else libx264.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const CANDIDATES: Record<string, string[]> = {
  darwin: ['h264_videotoolbox'],
  win32: ['h264_nvenc', 'h264_qsv', 'h264_amf'],
};

export async function detectHardwareEncoder(
  platform: string,
  tryEncoder: (encoder: string) => Promise<boolean>,
): Promise<string | null> {
  for (const encoder of CANDIDATES[platform] ?? []) {
    if (await tryEncoder(encoder)) return encoder;
  }
  return null;
}

export function videoEncoder(hardware: string | null): string {
  return hardware ?? 'libx264';
}

/**
 * Really encodes a short HD clip: an encoder can be built in yet unusable on this computer.
 * Use a realistic size: VideoToolbox rejects tiny frames such as 256×256.
 */
export function encoderTester(ffmpeg: string) {
  const run = promisify(execFile);
  return async (encoder: string): Promise<boolean> => {
    try {
      await run(ffmpeg, [
        ...[
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=black:s=1280x720:d=0.2',
        ],
        ...['-pix_fmt', 'yuv420p', '-c:v', encoder, '-f', 'null', '-'],
      ]);
      return true;
    } catch {
      return false;
    }
  };
}
