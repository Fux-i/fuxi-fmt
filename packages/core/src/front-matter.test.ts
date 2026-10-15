/**
 * Front matter: the block at the top of the file that a static site generator
 * reads before the body.
 *
 * FM-01 protects the YAML form byte for byte. FM-06 does the same for the TOML
 * form and says so, because unlike YAML there is no formatting of it to look
 * forward to: the block is preserved and reported rather than silently left
 * alone.
 *
 * Spec references: FM-01, FM-02, FM-06.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { format } from './format.ts';

describe('FM-06 TOML front matter is protected and reported', () => {
  test('a +++ block keeps its bytes and gets one warning', () => {
    const input = '+++\ntitle = "x"\n# a note\ntags = ["a","b"]\n+++\n\nBody\n';
    const result = format(input);
    assert.equal(result.output, input, 'the block is byte-verbatim');
    assert.equal(result.changed, false);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
    assert.equal(result.diagnostics[0]?.severity, 'warning');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('the body after the block still formats', () => {
    const result = format('+++\na = 1\n+++\n\n#标题\n');
    assert.equal(result.output, '+++\na = 1\n+++\n\n# 标题\n');
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
  });

  test('no rule fires inside the block', () => {
    // Read as prose, `# a note` is an ATX heading and `,` is punctuation to
    // convert; both rewrite a file another tool parses as configuration.
    const input = '+++\ntitle = "我的,笔记"\n#comment\n+++\n\nBody\n';
    assert.equal(format(input).output, input);
  });

  test('an unclosed +++ block is preserved to the end and reported', () => {
    const input = '+++\ntitle = "x"\n\nBody\n';
    const result = format(input);
    assert.equal(result.output, input);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.ruleId, 'FM-06');
    assert.equal(result.diagnostics[0]?.line, 0);
  });

  test('YAML front matter is not a TOML report', () => {
    assert.deepEqual(format('---\ntitle: x\n---\n\nBody\n').diagnostics, []);
  });

  test('a +++ line that is not at the top is prose', () => {
    assert.deepEqual(format('intro\n\n+++\n\nBody\n').diagnostics, []);
  });

  test('FM-06 is idempotent', () => {
    const input = '+++\na = 1\n+++\n\nBody\n';
    const once = format(input);
    assert.equal(format(once.output).output, once.output);
  });
});
