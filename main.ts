// VAULTBREAK entrypoint (Node 22, standard library only).
//
// The game lives in this directory as plain static files under game/
// (game/index.html plus its ES modules) and its screenshots under
// screenshots/. This program hands both in: it copies them into the
// grader's output directory and writes /output/dossier.json with the
// vendored make.fun library, exactly as the bounty requires.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The copy is byte-for-byte and the dossier is a pure function of the
// files it reads, so two runs write identical bytes.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the bounty gate: 4 screenshots at most 256 KiB each,
// game/ at most 993 files/directories and 48 MiB, paths at most 1000 bytes.
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Fail loudly on a partial hand-in instead of shipping a broken entry:
// the dossier only exists when buildDossier accepted game/ and
// screenshots/, so re-read it and confirm the entry's essentials are
// actually on disk before the grader ever sees them.
const dossierBytes = statSync(dossierPath).size;
if (dossierBytes < 100 || dossierBytes > 1.5 * 1024 * 1024) {
  throw new Error(`dossier.json has an unexpected size (${dossierBytes} bytes)`);
}
if (!existsSync(join(out, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing from the output');
}
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotFiles.length}`);
}
