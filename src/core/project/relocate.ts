// X1: in memory, media paths are absolute (ready to play). In the .mve file they are relative
// to the project file, so a project folder can move between computers.
import type { Project } from '../model/types.ts';
import { fromProjectPath, toProjectPath } from './paths.ts';

function relocate(project: Project, move: (path: string) => string): Project {
  const { audioMode } = project;
  return {
    ...project,
    media: project.media.map((m) => ({ ...m, path: move(m.path) })),
    ...(audioMode
      ? {
          audioMode: {
            ...audioMode,
            tracks: audioMode.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) => ({ ...c, file: move(c.file) })),
            })),
          },
        }
      : {}),
  };
}

export function projectToDisk(project: Project, projectDir: string): Project {
  return relocate(project, (path) => toProjectPath(projectDir, path));
}

export function projectFromDisk(project: Project, projectDir: string): Project {
  return relocate(project, (path) => fromProjectPath(projectDir, path));
}

/** Folder part of a path ("/a/b.mve" → "/a"), for Windows or POSIX paths. */
export function dirOf(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut < 0 ? '.' : path.slice(0, cut);
}

/** P2: a file name not yet in `used` (case-insensitive): photo.jpg, photo-2.jpg…; remembers it. */
export function uniqueFileName(file: string, used: Set<string>): string {
  const dot = file.lastIndexOf('.');
  const [base, ext] = dot > 0 ? [file.slice(0, dot), file.slice(dot)] : [file, ''];
  let name = file;
  for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base}-${n}${ext}`;
  used.add(name.toLowerCase());
  return name;
}

export function fileNameOf(path: string): string {
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}
