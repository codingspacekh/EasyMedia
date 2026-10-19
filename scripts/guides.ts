// Builds the guides shipped with the app (Help ▸ User guide, Help ▸ Teacher notes) as web pages
// in build-info/guides/, and keeps docs/guide/teacher-notes.md up to date.
// Usage: npm run guides
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYLLABUS } from '../src/core/teaching/syllabus.ts';
import { guidePage, teacherNotes } from './lib/guides.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const notes = teacherNotes(SYLLABUS);
await writeFile(join(root, 'docs/guide/teacher-notes.md'), notes);
const out = join(root, 'build-info/guides');
await mkdir(out, { recursive: true });
const guide = await readFile(join(root, 'docs/guide/user-guide.md'), 'utf8');
await writeFile(join(out, 'user-guide.html'), guidePage('User guide', guide));
await writeFile(join(out, 'teacher-notes.html'), guidePage('Teacher notes', notes));
console.log(`Guides written to ${out}`);
