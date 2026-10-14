import { describe, expect, it } from 'vitest';
import { detectHardwareEncoder, videoEncoder } from '../../../../src/main/ffmpeg/hardware.ts';

const works = (available: string[]) => {
  const tried: string[] = [];
  const tryEncoder = async (encoder: string) => (tried.push(encoder), available.includes(encoder));
  return { tried, tryEncoder };
};

describe('hardware video encoder', () => {
  it('uses VideoToolbox on macOS when it works', async () => {
    expect(await detectHardwareEncoder('darwin', works(['h264_videotoolbox']).tryEncoder)).toBe(
      'h264_videotoolbox',
    );
  });

  it('on Windows tries NVIDIA, then Intel, then AMD, and stops at the first that works', async () => {
    const t = works(['h264_qsv', 'h264_amf']);
    expect(await detectHardwareEncoder('win32', t.tryEncoder)).toBe('h264_qsv');
    expect(t.tried).toEqual(['h264_nvenc', 'h264_qsv']);
  });

  it('returns null when no hardware encoder works, or on other platforms', async () => {
    expect(await detectHardwareEncoder('win32', works([]).tryEncoder)).toBeNull();
    expect(await detectHardwareEncoder('linux', works(['h264_vaapi']).tryEncoder)).toBeNull();
  });

  it('falls back to the libx264 software encoder', () => {
    expect(videoEncoder(null)).toBe('libx264');
    expect(videoEncoder('h264_videotoolbox')).toBe('h264_videotoolbox');
  });
});
