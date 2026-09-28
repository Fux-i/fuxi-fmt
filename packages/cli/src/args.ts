/** Command line parsing. Pure, so it can be tested without a process. */

export type Mode = 'stdout' | 'check' | 'write' | 'diff' | 'help';

export interface ParsedArgs {
  readonly mode: Mode;
  readonly files: readonly string[];
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

  for (const arg of argv) {
    const flag = FLAGS[arg];
    if (flag !== undefined) {
      if (flag === 'help') return { mode: 'help', files: [] };
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

  return { mode, files };
}
