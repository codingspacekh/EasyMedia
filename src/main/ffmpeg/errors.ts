// Translates FFmpeg's stderr into messages students can act on (N11, ARCHITECTURE §9).
import { FILE_NOT_FOUND, MediaError } from '../../core/model/errors.ts';

const RULES: [RegExp, string][] = [
  [/No such file or directory/i, FILE_NOT_FOUND],
  [
    /Permission denied/i,
    'EasyMedia is not allowed to read or save this file. Check it is not open in another program and that you can save in this folder.',
  ],
  [/No space left on device/i, 'The disk is full. Free some space and try again.'],
  [
    /Unknown encoder|Encoder .* not found/i,
    'This export format is not available on this computer. Choose another format.',
  ],
  [
    /Decoder .* not found|codec not currently supported/i,
    'EasyMedia cannot read the format inside this file. Try converting it to MP4 first.',
  ],
  [
    /does not contain any stream|matches no streams/i,
    'This file has no picture or sound that EasyMedia can use.',
  ],
  [
    /Invalid data found when processing input|moov atom not found/i,
    'This file is damaged, or it is not a video, sound or picture file that EasyMedia can read.',
  ],
];

export function explainFfmpegError(stderr: string): MediaError {
  const detail = stderr.trim().split('\n').slice(-10).join('\n');
  const rule = RULES.find(([pattern]) => pattern.test(stderr));
  return new MediaError(
    rule?.[1] ?? 'Something went wrong while working on this file. Please try again.',
    detail,
  );
}
