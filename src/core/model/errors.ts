/** An edit that breaks a timeline rule. The message is shown to students as-is (N11). */
export class EditError extends Error {
  override name = 'EditError';
}

/** A project file that cannot be opened. The message is shown to students as-is. */
export class ProjectFileError extends Error {
  override name = 'ProjectFileError';
}

/** Shown when a media file is missing (shared by the real and the mock engine). */
export const FILE_NOT_FOUND =
  'The file could not be found. It may have been moved, renamed or deleted.';

/** A media file or FFmpeg job failed. `message` is for students; `detail` is the technical cause. */
export class MediaError extends Error {
  override name = 'MediaError';
  readonly detail: string;
  constructor(message: string, detail = '') {
    super(message);
    this.detail = detail;
  }
}

/** A background job was cancelled by the user. */
export class JobCancelledError extends Error {
  override name = 'JobCancelledError';
  constructor() {
    super('Cancelled.');
  }
}

/** X4: why the microphone cannot be used. */
export type MicrophoneProblem = 'denied' | 'none' | 'busy';
export type Platform = 'mac' | 'windows' | 'other';

/** X4: what to tell the student, with where to fix it on their system. */
export function microphoneMessage(problem: MicrophoneProblem, platform: Platform): string {
  if (problem === 'none')
    return 'No microphone found. Plug in a headset with a microphone, then try again.';
  if (problem === 'busy')
    return 'The microphone is being used by another app. Close that app (for example a video call), then try again.';
  if (platform === 'mac')
    return 'EasyMedia is not allowed to use the microphone. Open System Settings ▸ Privacy & Security ▸ Microphone, turn on EasyMedia, then try again.';
  if (platform === 'windows')
    return 'Windows is not letting EasyMedia use the microphone. Open Settings ▸ Privacy & security ▸ Microphone, turn on "Let desktop apps access your microphone", then try again.';
  return 'EasyMedia is not allowed to use the microphone. Allow it in your system settings, then try again.';
}

/** X4: the microphone could not be opened. The message is shown to students as-is. */
export class MicrophoneError extends Error {
  override name = 'MicrophoneError';
  readonly problem: MicrophoneProblem;
  constructor(problem: MicrophoneProblem, platform: Platform) {
    super(microphoneMessage(problem, platform));
    this.problem = problem;
  }
}
