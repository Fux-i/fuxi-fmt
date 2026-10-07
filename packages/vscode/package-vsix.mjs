/**
 * Package the extension into a .vsix.
 *
 * This deliberately does NOT run vsce in place, and that is the entire point of
 * the script.
 *
 * vsce's file collection walks OUT of the extension directory when the extension
 * sits inside a git repository. Run from packages/vscode it pulled in ../cli,
 * ../core and the whole repository root - 9,257 files, 183 MB, including .git -
 * and then failed outright with:
 *
 *   ERROR invalid relative path: extension/../../.editorconfig
 *
 * Both .vscodeignore and a package.json "files" whitelist were tried; neither
 * contains the walk. Staging the shipping files into a directory outside the
 * repository is what produces a correct package (nine files, ~470 KB).
 *
 * Run it from the repository root:
 *
 *   npm run vsix
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

/** Everything the extension host needs, and nothing else. */
const SHIPPED = [
  'package.json',
  // Without these the extension still works and every string shows as a raw
  // %key% in the Settings panel: the manifest is localised, so the locale files
  // are not optional extras.
  'package.nls.json',
  'package.nls.zh-cn.json',
  // The runtime strings the editor shows: without this directory every diagnostic
  // falls back to English, in silence.
  'l10n',
  'dist',
  'icon.png',
  'assets',
  'LICENSE',
  // Carried so the ignore rules still apply in the stage; without it the
  // sourcemap ships and the package doubles in size.
  '.vscodeignore',
];

/**
 * The marketplace reads the readme and the changelog out of the package, and
 * this repository has exactly one of each: the two at the root. They are
 * copied here rather than kept a second time under packages/vscode, because a
 * hand-maintained mirror is a thing that drifts - the pair that used to live
 * there had already stopped matching the files it mirrored.
 *
 * Copied, not linked. A symlink inside the package points outside it, and a
 * Windows checkout with core.symlinks=false turns one into a plain file whose
 * content is the target path. The copy exists only inside this temporary
 * directory and is removed in the finally block.
 */
const FROM_ROOT = ['README.md', 'CHANGELOG.md'];

const stage = mkdtempSync(join(tmpdir(), 'fuxi-fmt-vsix-'));
try {
  for (const entry of SHIPPED) {
    cpSync(join(here, entry), join(stage, entry), { recursive: true });
  }
  for (const entry of FROM_ROOT) {
    cpSync(join(root, entry), join(stage, entry));
  }

  // vsce runs vscode:prepublish before collecting. The staged copy has no
  // sources or build.mjs, and the caller has already built the bundle, so the
  // hook is dropped rather than made to fail.
  const manifest = JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'));
  delete manifest.scripts['vscode:prepublish'];
  writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');

  const outDir = join(root, 'output');
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, `fuxi-fmt-${manifest.version}.vsix`);

  execFileSync(join(root, 'node_modules', '.bin', 'vsce'), ['package', '--out', target], {
    cwd: stage,
    stdio: 'inherit',
  });
  console.log(`\nPackaged ${target}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
