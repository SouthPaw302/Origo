import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'node_modules/spessasynth_lib/dist/spessasynth_processor.min.js');
const publicDir = resolve(root, 'public');
const target = resolve(publicDir, 'spessasynth_processor.min.js');

await mkdir(publicDir, { recursive: true });
await copyFile(source, target);
console.log('Copied SpessaSynth AudioWorklet to public/spessasynth_processor.min.js');
