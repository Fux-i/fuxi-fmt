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
  '  --diff    print the lines that would change; write nothing',
  '  --write   rewrite the files in place',
  '  --help    print this message',
  '',
  'With no option the formatted document is written to stdout.',
  '',
].join('\n');

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Line based diff, deliberately simple: it is a CI hint, not a patch format. */
export function diffLines(path: string, before: string, after: string): string {
  const left = before.split('\n');
  const right = after.split('\n');
  let out = '--- ' + path + '\n';
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const a = left[i];
    const b = right[i];
    if (a === b) continue;
    if (a !== undefined && a.length > 0) out += '-' + a + '\n';
    if (b !== undefined && b.length > 0) out += '+' + b + '\n';
  }
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
