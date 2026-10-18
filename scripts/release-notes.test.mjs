import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { findSection, groupSubjects } from './release-notes.mjs';

const script = fileURLToPath(new URL('./release-notes.mjs', import.meta.url));

/** Fixtures live in a throwaway directory: nothing this suite writes may land in the tree. */
function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'release-notes-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** git needs an identity, and CI has none configured. */
function git(dir, ...args) {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', env });
}

function run(dir, args, env) {
  return spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', env });
}

const CHANGELOG = `# 变更日志

## [1.0.0](https://github.com/Fux-i/fuxi-fmt/compare/v0.31.0...v1.0.0) - 2026-10-16

### 新增

- 第一条

### 修复

- 第二条

## [0.31.0](https://github.com/Fux-i/fuxi-fmt/compare/v0.30.0...v0.31.0) - 2026-10-01

- 旧的
`;

test('the curated path drops the heading and reuses its compare link verbatim', (t) => {
  const dir = tempDir(t);
  writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);

  assert.deepEqual(findSection(CHANGELOG, '1.0.0'), {
    body: '### 新增\n\n- 第一条\n\n### 修复\n\n- 第二条',
    compare: 'https://github.com/Fux-i/fuxi-fmt/compare/v0.31.0...v1.0.0',
  });
  assert.equal(findSection(CHANGELOG, '2.0.0'), null);

  const result = run(dir, ['--version', '1.0.0']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    '### 新增\n\n- 第一条\n\n### 修复\n\n- 第二条\n\n' +
      '**Full Changelog**: <https://github.com/Fux-i/fuxi-fmt/compare/v0.31.0...v1.0.0>\n',
  );
});

test('groupSubjects keeps every subject verbatim under its own heading, in type order', () => {
  const subjects = [
    'chore(repo): release v1.0.0',
    'feat(core): add the scanner',
    'not a conventional commit',
    'fix(core): repair the scanner',
    'perf(core): scan once',
    'refactor(core): split the scanner',
    'docs(repo): document the scanner',
    'test(core): cover the scanner',
    'build(repo): bundle the scanner',
  ];
  assert.deepEqual(groupSubjects(subjects), [
    { heading: '### 新增', entries: ['- feat(core): add the scanner'] },
    { heading: '### 修复', entries: ['- fix(core): repair the scanner'] },
    { heading: '### 性能', entries: ['- perf(core): scan once'] },
    { heading: '### 重构', entries: ['- refactor(core): split the scanner'] },
    { heading: '### 文档', entries: ['- docs(repo): document the scanner'] },
    { heading: '### 测试', entries: ['- test(core): cover the scanner'] },
    { heading: '### 构建', entries: ['- build(repo): bundle the scanner'] },
    { heading: '### 杂务', entries: ['- chore(repo): release v1.0.0'] },
    { heading: '### 其他', entries: ['- not a conventional commit'] },
  ]);
});

/** Two commits released as v0.1.0, one more as v0.2.0, and a changelog with neither version. */
function releaseRepo(t) {
  const dir = tempDir(t);
  writeFileSync(
    join(dir, 'CHANGELOG.md'),
    `# 变更日志\n\n## [0.1.0](https://example.invalid) - 2020-01-01\n\n- 旧的\n`,
  );
  git(dir, 'init', '-q');
  for (const [file, subject] of [
    ['a.txt', 'feat(core): add the scanner'],
    ['b.txt', 'fix(core): repair the scanner'],
  ]) {
    writeFileSync(join(dir, file), `${file}\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', subject);
  }
  git(dir, 'tag', 'v0.1.0');
  writeFileSync(join(dir, 'c.txt'), 'c.txt\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'docs(repo): document the scanner');
  git(dir, 'tag', 'v0.2.0');
  git(dir, 'remote', 'add', 'origin', 'git@github.com:Fux-i/fuxi-fmt.git');
  return dir;
}

test('a version with no section and no commits in range exits 1', (t) => {
  const dir = releaseRepo(t);

  const result = run(dir, ['--version', '0.2.0', '--tag', 'v0.1.0', '--previous', 'v0.1.0']);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /nothing to release for 0\.2\.0/);
});

test('the fallback groups the commits in range under the right Chinese headings', (t) => {
  const dir = releaseRepo(t);
  const env = { ...process.env };
  delete env.GITHUB_REPOSITORY;

  const result = run(dir, ['--version', '0.2.0', '--previous', 'v0.1.0'], env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    '### 文档\n\n- docs(repo): document the scanner\n\n' +
      '**Full Changelog**: <https://github.com/Fux-i/fuxi-fmt/compare/v0.1.0...v0.2.0>\n',
  );
});

test('the fallback without --previous lists the whole history in group order', (t) => {
  const dir = releaseRepo(t);

  const result = run(dir, ['--version', '0.2.0'], { ...process.env, GITHUB_REPOSITORY: 'acme/fork' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    '### 新增\n\n- feat(core): add the scanner\n\n' +
      '### 修复\n\n- fix(core): repair the scanner\n\n' +
      '### 文档\n\n- docs(repo): document the scanner\n',
  );
});
