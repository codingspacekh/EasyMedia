/** An edit that breaks a timeline rule. The message is shown to students as-is (N11). */
export class EditError extends Error {
  override name = 'EditError';
}

/** A project file that cannot be opened. The message is shown to students as-is. */
export class ProjectFileError extends Error {
  override name = 'ProjectFileError';
}
