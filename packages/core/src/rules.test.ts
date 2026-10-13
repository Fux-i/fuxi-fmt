/**
 * CFG-02: every rule has a stable id.
 *
 * The ids the formatter can report are declared once, so a typo cannot compile
 * into a diagnostic under a rule that does not exist, and the inventory can be
 * walked. Severity stays written where each rule raises its diagnostic, which is
 * what CFG-02 asks of it.
 *
 * Spec references: CFG-02, GRT-04.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { RULE_IDS, RULE_SEVERITY, severityOf } from './rules.ts';
import { format } from './format.ts';

const DIR = new URL('./', import.meta.url);

/** Production sources only: a test may name a rule without reporting one. */
const sources = readdirSync(DIR)
  .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
  .sort();

describe('CFG-02 the severity of a rule', () => {
  test('every rule declares one of the three levels, and the table is the only source', () => {
    const levels: readonly string[] = ['error', 'warning', 'info'];
    for (const id of RULE_IDS) {
      const declared = severityOf(id);
      assert.ok(levels.includes(declared), id + ' declares ' + String(declared));
      assert.equal(RULE_SEVERITY[id], declared);
    }
  });

  test('a refusal is an error, a look-at-this is a warning, and a note is a note', () => {
    assert.equal(severityOf('DET-01'), 'error');
    assert.equal(severityOf('DET-13'), 'error');
    assert.equal(severityOf('GRT-01'), 'error');
    assert.equal(severityOf('SAFE-01'), 'error');
    assert.equal(severityOf('DET-06'), 'warning');
    assert.equal(severityOf('TYPO-11'), 'warning');
    assert.equal(severityOf('TBL-01'), 'info');
  });

  test('the severity a document reports is the severity the table declares', () => {
    const sources = [
      '```\ncode\n',
      '| a | b |\n| --- |\n| 1 | 2 | 3 |\n',
      '#标题\n\n中文abc\n',
      '中文"没配对的引号\n',
    ];
    for (const source of sources) {
      for (const diagnostic of format(source).diagnostics) {
        assert.equal(
          diagnostic.severity,
          severityOf(diagnostic.ruleId),
          diagnostic.ruleId + ' in ' + JSON.stringify(source),
        );
      }
    }
  });
});

describe('CFG-02 the rule inventory', () => {
  test('every id has the shape of a rule id, and none repeats', () => {
    for (const id of RULE_IDS) assert.match(id, /^[A-Z]{2,4}-\d{2}$/);
    assert.equal(new Set(RULE_IDS).size, RULE_IDS.length);
  });

  test('every rule id the production code names is in the inventory', () => {
    const found = new Set<string>();
    for (const name of sources) {
      for (const match of readFileSync(new URL(name, DIR), 'utf8').matchAll(/'([A-Z]{2,4}-\d{2})'/g)) {
        const id = match[1];
        if (id !== undefined) found.add(id);
      }
    }
    const missing = [...found].filter((id) => !(RULE_IDS as readonly string[]).includes(id)).sort();
    assert.deepEqual(missing, [], 'reported but not in the inventory');
  });

  test('the inventory names no rule the code cannot report', () => {
    const named = new Set<string>();
    for (const name of sources) {
      for (const match of readFileSync(new URL(name, DIR), 'utf8').matchAll(/'([A-Z]{2,4}-\d{2})'/g)) {
        const id = match[1];
        if (id !== undefined) named.add(id);
      }
    }
    const unused = RULE_IDS.filter((id) => !named.has(id)).sort();
    assert.deepEqual(unused, [], 'in the inventory but never reported');
  });
});
