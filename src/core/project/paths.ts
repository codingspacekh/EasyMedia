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

/** A numbered copy's name beside the original: Fish_Eagle.jpg, 1 → Fish_Eagle1.jpg. */
export function numberedPath(path: string, n: number): string {
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const [base, ext] = dot > slash ? [path.slice(0, dot), path.slice(dot)] : [path, ''];
  return `${base}${n}${ext}`;
}

/** The same path with another ending: pearl.jpg, ".png" → pearl.png (AN5: a see-through copy). */
export function withExtension(path: string, ext: string): string {
  const dot = path.lastIndexOf('.');
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return `${dot > slash ? path.slice(0, dot) : path}${ext}`;
}

/** A file name typed by the student: characters no file name may have (Windows, macOS) become "-". */
export function cleanFileName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '-');
}

/**
 * A new file beside `beside`, named `name` (cleaned) with the same extension: the student's name
 * for a picture made from another (m25credits.png, "credits" → credits.png).
 */
export function namedPath(beside: string, name: string): string {
  const slash = Math.max(beside.lastIndexOf('/'), beside.lastIndexOf('\\'));
  const dot = beside.lastIndexOf('.');
  const ext = dot > slash ? beside.slice(dot) : '';
  let stem = cleanFileName(name);
  if (ext && stem.toLowerCase().endsWith(ext.toLowerCase())) stem = stem.slice(0, -ext.length);
  return `${beside.slice(0, slash + 1)}${stem}${ext}`;
}

/**
 * Try number `attempt` (0, 1, 2…) for a new picture made from `input` (V11, V18): the name the
 * student typed, then name2, name3…; with no name, input1, input2…. The caller takes the first that
 * does not exist, so nothing is ever overwritten.
 */
export function madePicturePath(input: string, name: string | undefined, attempt: number): string {
  if (name !== undefined && cleanFileName(name) !== '') {
    const named = namedPath(input, name);
    return attempt === 0 ? named : numberedPath(named, attempt + 1);
  }
  return numberedPath(input, attempt + 1);
}

/** Absolute media path → the path to store in the project file. */
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
