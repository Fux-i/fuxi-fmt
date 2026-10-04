/** Command line parsing. Pure, so it can be tested without a process. */

export type Mode = 'stdout' | 'check' | 'write' | 'diff' | 'help';

export interface ParsedArgs {
  readonly mode: Mode;
  readonly files: readonly string[];
  /** Report what happened and why, instead of only what changed. */
  readonly explain: boolean;
  /**
   * The language to print messages in, when it was asked for (CFG-08). Absent
   * means "decide from the environment", which is what a shell already knows.
   */
  readonly lang?: string;
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
  let lang: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    // A modifier rather than a mode: it says how much to say, not what to do.
    if (arg === '--explain') {
      explain = true;
      continue;
    }
    // Also a modifier. The value is a language tag, so it may look like a flag's
    // argument rather than a file; nothing else here takes one.
    if (arg === '--lang' || arg.startsWith('--lang=')) {
      const value = arg === '--lang' ? argv[i + 1] : arg.slice('--lang='.length);
      if (value === undefined || value.length === 0 || value.startsWith('-')) {
        throw new Error('fuxi-fmt: --lang needs a language, for example --lang zh');
      }
      lang = value;
      if (arg === '--lang') i++;
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

  return lang === undefined ? { mode, files, explain } : { mode, files, explain, lang };
}
