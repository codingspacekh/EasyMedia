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
