// X1: media paths are stored relative to the project file, always with "/" separators,
// so a project folder can move between Windows and macOS computers. Pure string logic
// (core/ cannot use node:path).

interface SplitPath {
  /** "/" for POSIX paths, "c:" (lower-case) for Windows drives. */
  root: string;
  /** How the root is written back: "/" or "C:/". */
  prefix: string;
  parts: string[];
}

function splitPath(path: string): SplitPath {
  const p = path.replaceAll('\\', '/');
  const drive = /^([A-Za-z]):\//.exec(p);
  const rest = drive ? p.slice(3) : p.replace(/^\/+/, '');
  return {
    root: drive ? `${drive[1]!.toLowerCase()}:` : '/',
    prefix: drive ? `${drive[1]}:/` : '/',
    parts: rest.split('/').filter((s) => s !== '' && s !== '.'),
  };
}

function isAbsolute(path: string): boolean {
  return /^([A-Za-z]:)?[\\/]/.test(path);
}

/** Absolute media path → the path to store in the project file. */
/** The `n`th name in a series: Eagle1.jpg → Eagle2.jpg, photo.jpg → photo2.jpg. */
export function numberedPath(path: string, n: number): string {
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const [base, ext] = dot > slash ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  return `${base.replace(/\d+$/, '')}${n}${ext}`;
}

export function toProjectPath(projectDir: string, filePath: string): string {
  const dir = splitPath(projectDir);
  const file = splitPath(filePath);
  if (dir.root !== file.root) return file.prefix + file.parts.join('/');
  let common = 0;
  while (common < dir.parts.length && dir.parts[common] === file.parts[common]) common++;
  return [...dir.parts.slice(common).map(() => '..'), ...file.parts.slice(common)].join('/');
}

/** Path stored in the project file → absolute path (with "/" separators). */
export function fromProjectPath(projectDir: string, stored: string): string {
  if (isAbsolute(stored)) {
    const s = splitPath(stored);
    return s.prefix + s.parts.join('/');
  }
  const dir = splitPath(projectDir);
  const parts = [...dir.parts];
  for (const part of stored.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '' && part !== '.') parts.push(part);
  }
  return dir.prefix + parts.join('/');
}
