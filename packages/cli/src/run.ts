import { readFileSync, writeFileSync } from 'node:fs';
import { format, loadOptionsFor } from '../../core/src/index.ts';
import type { FormatOptionsInput } from '../../core/src/index.ts';
import { parseArgs } from './args.ts';

/** Everything the command needs from the outside world, injected for testing. */
export interface Io {
  read(path: string): string;
  write(path: string, text: string): void;
  out(text: string): void;
  err(text: string): void;
  optionsFor(path: string): FormatOptionsInput;
}

export const EXIT_OK = 0;
export const EXIT_CHANGES = 1;
export const EXIT_ERROR = 2;

export const USAGE = [
  'fuxi-fmt - format Markdown for Chinese technical writing',
  '',
  'Usage: fuxi-fmt [options] <file...>',
  '',
  'Options:',
  '  --check   exit 1 if any file would change; write nothing',
  '  --diff    print the lines that would change, approximately; write nothing',
  '  --write   rewrite the files in place',
  '  --help    print this message',
  '',
  'With no option the formatted document is written to stdout.',
  '',
].join('\n');

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Line based diff, deliberately simple: it is a CI hint, not a patch format.
 *
 * It aligns by common prefix and suffix rather than by index. Comparing index
 * to index made a single inserted blank line report every subsequent line as
 * removed and re-added - which, for a formatter whose selling point is minimal
 * diffs, is the worst possible lie to tell. Blank lines are shown, because
 * blank-line normalisation is one of the things being reported.
 *
 * KNOWN LIMITATION, and it is the common case rather than the edge: the region
 * between the common prefix and the common suffix is emitted wholesale, so a
 * document edited in several places reports unchanged lines on both sides. The
 * fix is a line alignment algorithm - LCS or Myers - shared with the adapter's
 * computeEdits, which approximates the same problem the same way. Until then
 * this output is a hint about where to look, not a patch, and --help says so.
 */
export function diffLines(path: string, before: string, after: string): string {
  const left = before.split('\n');
  const right = after.split('\n');

  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < left.length - prefix &&
    suffix < right.length - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix++;
  }

  let out = '--- ' + path + '\n';
  for (let i = prefix; i < left.length - suffix; i++) out += '-' + (left[i] ?? '') + '\n';
  for (let i = prefix; i < right.length - suffix; i++) out += '+' + (right[i] ?? '') + '\n';
  return out;
}

export function run(argv: readonly string[], io: Io): number {
  let mode;
  let files;
  try {
    const parsed = parseArgs(argv);
    mode = parsed.mode;
    files = parsed.files;
  } catch (error) {
    io.err(messageOf(error) + '\n');
    return EXIT_ERROR;
  }

  if (mode === 'help') {
    io.out(USAGE);
    return EXIT_OK;
  }
  if (files.length === 0) {
    io.err('fuxi-fmt: no files given\n' + USAGE);
    return EXIT_ERROR;
  }

  let changed = false;

  for (const file of files) {
    let source: string;
    try {
      source = io.read(file);
    } catch (error) {
      io.err('fuxi-fmt: ' + messageOf(error) + '\n');
      return EXIT_ERROR;
    }

    const result = format(source, io.optionsFor(file));

    // The guard tripped: the file is reported rather than silently left alone.
    if (result.diagnostics.length > 0) {
      for (const diagnostic of result.diagnostics) {
        io.err('fuxi-fmt: ' + file + ': ' + diagnostic.ruleId + ' ' + diagnostic.message + '\n');
      }
      return EXIT_ERROR;
    }

    if (!result.changed) {
      if (mode === 'stdout') io.out(result.output);
      continue;
    }

    changed = true;
    if (mode === 'check') io.err(file + ': would be reformatted\n');
    else if (mode === 'diff') io.out(diffLines(file, source, result.output));
    else if (mode === 'write') io.write(file, result.output);
    else io.out(result.output);
  }

  if ((mode === 'check' || mode === 'diff') && changed) return EXIT_CHANGES;
  return EXIT_OK;
}

export const fileIo: Io = {
  read: (path) => readFileSync(path, 'utf8'),
  write: (path, text) => writeFileSync(path, text),
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
  optionsFor: (path) => loadOptionsFor(path).options,
};
