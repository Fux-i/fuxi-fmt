/** Command line parsing. Pure, so it can be tested without a process. */

export type Mode = 'stdout' | 'check' | 'write' | 'diff' | 'help';

export interface ParsedArgs {
  readonly mode: Mode;
  readonly files: readonly string[];
  /** Report what happened and why, instead of only what changed. */
  readonly explain: boolean;
}

const FLAGS: Readonly<Record<string, Mode>> = {
  '--check': 'check',
  '--write': 'write',
  '--diff': 'diff',
  '--help': 'help',
  '-h': 'help',
};

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const files: string[] = [];
  let mode: Mode = 'stdout';
  let chosen = false;
  let explain = false;

  for (const arg of argv) {
    // A modifier rather than a mode: it says how much to say, not what to do.
    if (arg === '--explain') {
      explain = true;
      continue;
    }
    const flag = FLAGS[arg];
    if (flag !== undefined) {
      if (flag === 'help') return { mode: 'help', files: [], explain };
      if (chosen) throw new Error('fuxi-fmt: pick one of --check, --write or --diff');
      mode = flag;
      chosen = true;
      continue;
    }
    if (arg.startsWith('-') && arg !== '-') {
      throw new Error('fuxi-fmt: unknown option ' + arg);
    }
    files.push(arg);
  }

  return { mode, files, explain };
}
