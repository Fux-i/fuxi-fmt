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
import { RULES, RULE_IDS, severityOf } from './rules.ts';
import { MESSAGES } from './messages.ts';
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
      assert.equal(RULES[id].severity, declared);
    }
  });

  test('every rule declares the messages it can report', () => {
    for (const id of RULE_IDS) {
      assert.ok(RULES[id].messages.length > 0, id + ' declares no message');
    }
  });

  test('a rule message belongs to exactly one rule', () => {
    // The catalogue says what a message is; only the rule table says which rule
    // owns it. Before this the link was convention, so a message could be
    // reported under a rule that does not own it and nothing noticed.
    const owners = new Map<string, string[]>();
    for (const id of RULE_IDS) {
      for (const message of RULES[id].messages) {
        assert.ok(message in MESSAGES, id + ' declares an unknown message ' + message);
        owners.set(message, [...(owners.get(message) ?? []), id]);
      }
    }
    const isNotice = (message: string): boolean => message.startsWith('cfg.');
    const missing = Object.keys(MESSAGES)
      .filter((message) => !isNotice(message) && !owners.has(message))
      .sort();
    assert.deepEqual(missing, [], 'a rule message that no rule declares');
    const doubled = [...owners.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([message]) => message);
    assert.deepEqual(doubled, [], 'a message declared by more than one rule');
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
