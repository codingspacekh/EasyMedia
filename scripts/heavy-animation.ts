// Saves the performance checks' animation (M17 step 2: 1024 × 768, 10 s at 30 fps, 100 moving
// objects on five layers) as an .mvea file, for the teacher's N1 / N2 run on the weakest laptop.
// Usage: npm run heavy-animation [-- --out some/Heavy.mvea]   (default: Heavy.mvea on the Desktop)
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { serializeAnimation } from '../src/core/animation/serialize.ts';
import { HEAVY, heavyAnimation } from './lib/heavy-animation.ts';

const args = process.argv.slice(2);
const out = args.includes('--out')
  ? resolve(args[args.indexOf('--out') + 1]!)
  : join(homedir(), 'Desktop', 'Heavy.mvea');

await writeFile(out, serializeAnimation(heavyAnimation()));
console.log(
  `Saved ${out}: ${HEAVY.width} × ${HEAVY.height}, ${HEAVY.seconds} s at ${HEAVY.fps} fps, ` +
    `${HEAVY.objects} objects on ${HEAVY.layers} layers.`,
);
