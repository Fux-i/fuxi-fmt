/**
 * Build the body of a GitHub release from the curated changelog, falling back to
 * the commit subjects when the changelog has no section for that version.
 *
 *   node scripts/release-notes.mjs --version <x.y.z> \
 *     [--tag <vX.Y.Z>] [--previous <tag>] [--changelog <path>]
 *
 * The body goes to stdout and nothing else. A version with neither a changelog
 * section nor commits in range exits 1: publishing an empty release notes body
 * fails silently, which is the one outcome a release job must not have.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Conventional-commit types and the heading each one gets, in output order. */
const GROUPS = [
  ['feat', '### 新增'],
  ['fix', '### 修复'],
  ['perf', '### 性能'],
  ['refactor', '### 重构'],
  ['docs', '### 文档'],
  ['test', '### 测试'],
  ['build', '### 构建'],
  ['chore', '### 杂务'],
];
const OTHER = '### 其他';

const USAGE =
  'usage: release-notes.mjs --version <x.y.z> [--tag <vX.Y.Z>] [--previous <tag>] [--changelog <path>]';

/**
 * The changelog section for a version, without its heading: the body is what
 * follows the `## [<version>]` line up to the next section. `compare` is the
 * heading's compare link, kept so the release can reuse the exact URL the
 * changelog already publishes instead of rebuilding one that may differ.
 */
export function findSection(changelog, version) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start === -1) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return { body, compare: compareHref(lines[start]) };
}

const COMPARE = /\]\((https:\/\/github\.com\/[^)\s]+\/compare\/[^)\s]+\.\.\.[^)\s]+)\)/;

function compareHref(heading) {
  return COMPARE.exec(heading)?.[1] ?? null;
}

/** The non-empty groups, in GROUPS order, for a list of commit subjects. */
export function groupSubjects(subjects) {
  const buckets = [...GROUPS, [null, OTHER]].map(([, heading]) => ({ heading, entries: [] }));
  for (const subject of subjects) {
    const type = /^([a-z]+)(?:\([^)]*\))?!?:/.exec(subject)?.[1];
    const index = GROUPS.findIndex(([known]) => known === type);
    buckets[index === -1 ? buckets.length - 1 : index].entries.push(`- ${subject}`);
  }
  return buckets.filter(({ entries }) => entries.length > 0);
}

function renderGroups(groups) {
  return groups.map(({ heading, entries }) => `${heading}\n\n${entries.join('\n')}`).join('\n\n');
}

/** Subjects between two tags, or the whole history when no previous tag is known. */
function commitSubjects(previous, tag) {
  const args = ['log', '--no-merges', '--pretty=format:%s', ...(previous ? [`${previous}..${tag}`] : [])];
  return execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
}

/** https://github.com/<owner>/<repo>, from the CI variable or the origin remote. */
export function repositoryUrl() {
  const remote =
    process.env.GITHUB_REPOSITORY ??
    execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
  const slug = /^(?:git@github\.com:|https:\/\/github\.com\/)(.+?)(?:\.git)?$/.exec(remote)?.[1] ?? remote;
  return `https://github.com/${slug}`;
}

function buildNotes({ version, tag, previous, changelog }) {
  const section = findSection(readFileSync(changelog, 'utf8'), version);
  const body = section ? section.body : renderGroups(groupSubjects(commitSubjects(previous, tag)));
  if (body === '') {
    return null;
  }
  const href = section?.compare?.endsWith(`...${tag}`)
    ? section.compare
    : previous && `${repositoryUrl()}/compare/${previous}...${tag}`;
  return href ? `${body}\n\n**Full Changelog**: <${href}>` : body;
}

function main(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    options[argv[index].slice(2)] = argv[index + 1];
  }
  const { version, previous, changelog = 'CHANGELOG.md' } = options;
  if (!version) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  const tag = options.tag ?? `v${version}`;
  try {
    const notes = buildNotes({ version, tag, previous, changelog });
    if (notes === null) {
      process.stderr.write(`release-notes: nothing to release for ${version}\n`);
      return 1;
    }
    process.stdout.write(`${notes}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`release-notes: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
