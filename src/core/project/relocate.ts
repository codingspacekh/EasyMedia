// X1: in memory, media paths are absolute (ready to play). In the .mve file they are relative
// to the project file, so a project folder can move between computers.
import type { Project } from '../model/types.ts';
import { fromProjectPath, toProjectPath } from './paths.ts';

export function projectToDisk(project: Project, projectDir: string): Project {
  return {
    ...project,
    media: project.media.map((m) => ({ ...m, path: toProjectPath(projectDir, m.path) })),
  };
}

export function projectFromDisk(project: Project, projectDir: string): Project {
  return {
    ...project,
    media: project.media.map((m) => ({ ...m, path: fromProjectPath(projectDir, m.path) })),
  };
}

/** Folder part of a path ("/a/b.mve" → "/a"), for Windows or POSIX paths. */
export function dirOf(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut < 0 ? '.' : path.slice(0, cut);
}

export function fileNameOf(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}
