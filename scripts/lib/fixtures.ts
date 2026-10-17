// Synthetic test media (MILESTONES §3.2). Generated with FFmpeg's built-in sources,
// so no copyrighted coursebook files are needed in the repository.
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

export interface FixtureSpec {
  name: string;
  /** "test" fixtures are used by automated tests; "spike" ones only by performance experiments. */
  group: 'test' | 'spike';
  inputs: string[];
  output: string[];
  expect: {
    durationS?: number;
    video?: { codec: string; width: number; height: number };
    audio?: { codec: string; channels: number; sampleRate: number };
  };
}

const lavfi = (graph: string) => ['-f', 'lavfi', '-i', graph];
const testsrc = (w: number, h: number, seconds: number) =>
  lavfi(`testsrc2=size=${w}x${h}:rate=30:duration=${seconds}`);
const sine = (seconds: number) => lavfi(`sine=frequency=440:sample_rate=44100:duration=${seconds}`);
const tone = (exprs: string, seconds: number) =>
  lavfi(`aevalsrc=exprs='${exprs}':sample_rate=44100:duration=${seconds}`);

const h264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p'];
const aacStereo = ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'];

export const FIXTURES: FixtureSpec[] = [
  {
    name: 'clip_1080p30_10s.mp4',
    group: 'test',
    inputs: [...testsrc(1920, 1080, 10), ...sine(10)],
    output: [...h264, ...aacStereo],
    expect: {
      durationS: 10,
      video: { codec: 'h264', width: 1920, height: 1080 },
      audio: { codec: 'aac', channels: 2, sampleRate: 44100 },
    },
  },
  {
    // Stand-in for Lake_Naivasha.mp4 (Book B Tasks 11b, 11c): long enough to trim 8–12.5 s.
    // Its brightness rises steadily with time (luma 16 + 10 per second), so a test can tell
    // which moment of the source any exported frame came from.
    name: 'lake_1080p30_20s.mp4',
    group: 'test',
    inputs: [
      ...lavfi("color=c=black:s=64x36:r=30:d=20,geq=lum='16+10*T':cb=128:cr=128,scale=1920:1080"),
      ...sine(20),
    ],
    output: [...h264, ...aacStereo],
    expect: {
      durationS: 20,
      video: { codec: 'h264', width: 1920, height: 1080 },
      audio: { codec: 'aac', channels: 2, sampleRate: 44100 },
    },
  },
  {
    name: 'clip_4x3_640x480.mov',
    group: 'test',
    inputs: [...testsrc(640, 480, 5), ...sine(5)],
    output: [...h264, ...aacStereo],
    expect: {
      durationS: 5,
      video: { codec: 'h264', width: 640, height: 480 },
      audio: { codec: 'aac', channels: 2, sampleRate: 44100 },
    },
  },
  {
    name: 'clip_4x3_640x480.avi',
    group: 'test',
    inputs: [...testsrc(640, 480, 5), ...sine(5)],
    output: ['-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame', '-b:a', '128k', '-ac', '2'],
    expect: {
      durationS: 5,
      video: { codec: 'mpeg4', width: 640, height: 480 },
      audio: { codec: 'mp3', channels: 2, sampleRate: 44100 },
    },
  },
  {
    name: 'clip_4x3_640x480.wmv',
    group: 'test',
    inputs: [...testsrc(640, 480, 5), ...sine(5)],
    output: ['-c:v', 'wmv2', '-q:v', '5', '-c:a', 'wmav2', '-b:a', '128k', '-ac', '2'],
    expect: {
      durationS: 5,
      video: { codec: 'wmv2', width: 640, height: 480 },
      audio: { codec: 'wmav2', channels: 2, sampleRate: 44100 },
    },
  },
  {
    // Same size as Fish_Eagle.jpg in the coursebook, for the resize & crop task (V11).
    name: 'photo_3764x3092.jpg',
    group: 'test',
    inputs: testsrc(3764, 3092, 1),
    output: ['-frames:v', '1', '-q:v', '3'],
    expect: { video: { codec: 'mjpeg', width: 3764, height: 3092 } },
  },
  {
    name: 'music_stereo_45s.mp3',
    group: 'test',
    inputs: tone('0.4*sin(2*PI*262*t)|0.4*sin(2*PI*330*t)', 45),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 45, audio: { codec: 'mp3', channels: 2, sampleRate: 44100 } },
  },
  {
    // A 440 Hz tone sitting 0.2 above zero: for normalise / remove DC offset (A3).
    name: 'tone_dc_offset.wav',
    group: 'test',
    inputs: tone('0.3*sin(2*PI*440*t)+0.2', 5),
    output: ['-c:a', 'pcm_s16le'],
    expect: { durationS: 5, audio: { codec: 'pcm_s16le', channels: 1, sampleRate: 44100 } },
  },
  {
    // Speech-like bursts plus constant hiss: for noise reduction (A13) and compressor (A19).
    name: 'voice_noisy.wav',
    group: 'test',
    inputs: tone('0.5*sin(2*PI*220*t)*gt(sin(2*PI*1.5*t),0)+0.05*(2*random(0)-1)', 8),
    output: ['-c:a', 'pcm_s16le'],
    expect: { durationS: 8, audio: { codec: 'pcm_s16le', channels: 1, sampleRate: 44100 } },
  },
  {
    // Stand-in for 11.05 Piano_track.mp3 (Book A 11.16–11.19): a louder burst at 39–40 s is the
    // "sound wave section" that is copied and pasted at 16 s.
    name: 'piano_stereo_60s.mp3',
    group: 'test',
    inputs: tone(
      '(0.3+0.5*between(t,39,40))*sin(2*PI*262*t)|(0.3+0.5*between(t,39,40))*sin(2*PI*330*t)',
      60,
    ),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 60, audio: { codec: 'mp3', channels: 2, sampleRate: 44100 } },
  },
  {
    // Stand-in for Task_11j_audio_1.mp3 / Activity_11e_audio_1.mp3: quiet, sitting 0.2 above zero
    // (a DC offset to remove, Book B 11.2.2).
    name: 'song_dc_offset_90s.mp3',
    group: 'test',
    inputs: tone('0.15*sin(2*PI*440*t)+0.2|0.15*sin(2*PI*554*t)+0.2', 90),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 90, audio: { codec: 'mp3', channels: 2, sampleRate: 44100 } },
  },
  {
    // Stand-in for Task_11j_audio_2.mp3 / Activity_11e_audio_2.mp3.
    name: 'song_48s.mp3',
    group: 'test',
    inputs: tone('0.5*sin(2*PI*349*t)|0.5*sin(2*PI*440*t)', 48),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 48, audio: { codec: 'mp3', channels: 2, sampleRate: 44100 } },
  },
  {
    // Stand-in for Task_11j.mp3 (Book B 11.2.10, Task 11k): two parts recorded in different keys,
    // the first 19 s in C (C4, 261.63 Hz), the rest in F (F4, 349.23 Hz).
    name: 'two_keys_45s.mp3',
    group: 'test',
    inputs: tone('0.4*if(lt(t,19),sin(2*PI*261.63*t),sin(2*PI*349.23*t))', 45),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 45, audio: { codec: 'mp3', channels: 1, sampleRate: 44100 } },
  },
  {
    // Stand-in for Activity_11e.mp3 (Activity 11f): the first 30.6 s in C♯ (277.18 Hz), the rest
    // in F♯ (369.99 Hz).
    name: 'two_keys_43s.mp3',
    group: 'test',
    inputs: tone(
      '0.4*if(lt(t,30.6),sin(2*PI*277.18*t),sin(2*PI*369.99*t))|0.4*if(lt(t,30.6),sin(2*PI*277.18*t),sin(2*PI*369.99*t))',
      43.4,
    ),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 43.4, audio: { codec: 'mp3', channels: 2, sampleRate: 44100 } },
  },
  {
    // Stand-in for 11.06 Bee_Voiceover.mp3 (Book A 11.20): a 300 Hz "voice" that rises and falls.
    name: 'bee_voiceover_6s.mp3',
    group: 'test',
    inputs: tone('(0.3+0.1*sin(2*PI*3*t))*sin(2*PI*300*t)', 6),
    output: ['-c:a', 'libmp3lame', '-b:a', '128k'],
    expect: { durationS: 6, audio: { codec: 'mp3', channels: 1, sampleRate: 44100 } },
  },
  {
    // Stand-in for Task_11o_audio.mp3 (Task 11o) and the voiceover intro (Book A 11.23): a 50 ms
    // beep (1 kHz, 0.3) every 2 s, with silence between, so each echo can be measured.
    name: 'beeps_30s.mp3',
    group: 'test',
    inputs: tone('0.3*lt(mod(t,2),0.05)*sin(2*PI*1000*t)', 30),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 30, audio: { codec: 'mp3', channels: 1, sampleRate: 44100 } },
  },
  {
    // Stand-in for Voiceover_2.mp3, Task_11n_audio.mp3 and Blue_Sky_Blues.mp3 (Tasks 11m, 11n,
    // Activities 11g, 11h): a bass tone (100 Hz) and a treble tone (8 kHz), each measured on its own.
    name: 'bass_treble_120s.mp3',
    group: 'test',
    inputs: tone('0.2*sin(2*PI*100*t)+0.2*sin(2*PI*8000*t)', 120),
    output: ['-c:a', 'libmp3lame', '-b:a', '192k'],
    expect: { durationS: 120, audio: { codec: 'mp3', channels: 1, sampleRate: 44100 } },
  },
  {
    // Real MP3s often carry album art, which ffprobe reports as a video stream (attached picture).
    name: 'music_with_cover.mp3',
    group: 'test',
    inputs: [
      ...tone('0.4*sin(2*PI*262*t)', 5),
      ...lavfi('testsrc2=size=300x300:rate=1:duration=1'),
    ],
    output: [
      ...['-map', '0:a', '-map', '1:v'],
      ...['-c:a', 'libmp3lame', '-b:a', '128k', '-c:v', 'mjpeg', '-disposition:v', 'attached_pic'],
    ],
    expect: {
      durationS: 5,
      video: { codec: 'mjpeg', width: 300, height: 300 },
      audio: { codec: 'mp3', channels: 1, sampleRate: 44100 },
    },
  },
  {
    // One minute of full-HD video for the M0 performance spike.
    name: 'spike_1080p30_60s.mp4',
    group: 'spike',
    inputs: [...testsrc(1920, 1080, 60), ...sine(60)],
    output: [...h264, '-crf', '23', ...aacStereo],
    expect: {
      durationS: 60,
      video: { codec: 'h264', width: 1920, height: 1080 },
      audio: { codec: 'aac', channels: 2, sampleRate: 44100 },
    },
  },
];

export function selectFixtures(all: FixtureSpec[], group: FixtureSpec['group']): FixtureSpec[] {
  return all.filter((f) => f.group === group);
}

export function ffmpegArgs(spec: FixtureSpec, outDir: string): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...spec.inputs,
    ...spec.output,
    join(outDir, spec.name),
  ];
}

export async function generateFixtures(
  ffmpeg: string,
  outDir: string,
  specs: FixtureSpec[],
): Promise<void> {
  const run = promisify(execFile);
  for (const spec of specs) {
    await run(ffmpeg, ffmpegArgs(spec, outDir));
  }
}
