// Errors are sent between the main process and the page as plain data and rebuilt here, so the
// student still sees the plain-English message (N11) and the code can tell the kinds apart.
import { EditError, JobCancelledError, MediaError, ProjectFileError } from './model/errors.ts';

export interface WireError {
  name: string;
  message: string;
  detail?: string;
}

export function toWire(error: unknown): WireError {
  const e = error as Error & { detail?: string };
  return {
    name: e?.name ?? 'Error',
    message: e?.message ?? String(error),
    ...(e?.detail ? { detail: e.detail } : {}),
  };
}

export function fromWire(wire: WireError): Error {
  switch (wire.name) {
    case 'EditError':
      return new EditError(wire.message);
    case 'MediaError':
      return new MediaError(wire.message, wire.detail ?? '');
    case 'ProjectFileError':
      return new ProjectFileError(wire.message);
    case 'JobCancelledError':
      return new JobCancelledError();
    default:
      return new Error('Something went wrong. Please try again.');
  }
}
