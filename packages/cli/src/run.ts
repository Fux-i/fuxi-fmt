import { readFileSync, writeFileSync } from 'node:fs';
import { diffEdits, format, loadOptionsFor } from '../../core/src/index.ts';
import type { FormatOptionsInput, LoadedConfig } from '../../core/src/index.ts';
import { parseArgs } from './args.ts';

/** Everything the command needs from the outside world, injected for testing. */
export interface Io {
  read(path: string): string;
  write(path: string, text: string): void;
  out(text: string): void;
  err(text: string): void;
  optionsFor(path: string): FormatOptionsInput;
  /**
   * Where the configuration came from and what it said. Optional, so a host that
   * only knows the resolved options still works.
   */
  configFor?(path: string): LoadedConfig;
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
  '  --explain say what was found and what was done, on stderr',
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
 * Alignment lives in core/diff.ts, so the CLI and the adapter cannot drift into
 * two answers to one question. This only formats that result.
 */
export function diffLines(path: string, before: string, after: string): string {
  let out = '--- ' + path + '\n';
  for (const edit of diffEdits(before, after)) {
    out += diffSide('-', before.slice(edit.start, edit.end));
    out += diffSide('+', edit.text);
  }
  return out;
}

/** One side, without a stray empty line from a trailing newline. */
function diffSide(prefix: string, text: string): string {
  if (text.length === 0) return '';
  const parts = text.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.map((line) => prefix + line + '\n').join('');
}

export function run(argv: readonly string[], io: Io): number {
  let mode;
  let files;
  let explain = false;
  try {
    const parsed = parseArgs(argv);
    mode = parsed.mode;
    files = parsed.files;
    explain = parsed.explain;
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

    const loaded = io.configFor?.(file);
    const result = format(source, loaded?.options ?? io.optionsFor(file));

    // A configuration notice is not a failure. The file still formats; the author
    // is told that a key they wrote did less than they asked for, which is the one
    // thing a silently ignored key can never say.
    for (const notice of loaded?.notices ?? []) {
      io.err('fuxi-fmt: ' + file + ': ' + notice.key + ': ' + notice.message + '\n');
    }

    // Errors refuse the document, warnings do not. Failing a build on a warning is
    // how a useful warning becomes a reason to switch the rule off.
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.severity !== 'warning') continue;
      io.err(
        'fuxi-fmt: ' + file + ': warning: ' + diagnostic.ruleId + ' ' + diagnostic.message + '\n',
      );
    }
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      for (const diagnostic of errors) {
        io.err('fuxi-fmt: ' + file + ': ' + diagnostic.ruleId + ' ' + diagnostic.message + '\n');
      }
      return EXIT_ERROR;
    }

    if (explain) {
      io.err(
        'fuxi-fmt: ' + file + '\n' +
          '  config: ' + (loaded?.configPath ?? 'none, using the defaults') + '\n' +
          '  changed: ' + (result.changed ? 'yes' : 'no') + '\n' +
          '  warnings: ' + String(result.diagnostics.length) + '\n',
      );
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
  configFor: (path) => loadOptionsFor(path),
};
