/**
 * CFG-02: every rule has a stable id, its own severity, and the messages it can
 * report.
 *
 * All three live here rather than at the places a rule reports something. The
 * severity is a property of the rule and not a setting, so two call sites of one
 * rule can no longer disagree about whether the document is refused; and the
 * messages a rule owns are a fact about the rule that was previously only a
 * naming convention, which nothing checked.
 *
 * Spec references: CFG-02, CFG-08.
 */

import type { MessageId } from './messages.ts';

/** The three levels a rule can be reported at. */
export const SEVERITIES = ['error', 'warning', 'info'] as const;

export type Severity = (typeof SEVERITIES)[number];

export interface Rule {
  readonly severity: Severity;
  /** Every message this rule can put in a diagnostic. */
  readonly messages: readonly MessageId[];
}

/**
 * Every rule the formatter can report.
 *
 * An error refuses the document and returns the input unchanged; a warning
 * formats it and says what wants a look; a note reports what the formatter did
 * rather than anything wrong with the document.
 */
export const RULES = {
  'DET-01': { severity: 'error', messages: ['det.fenceUnterminated'] },
  'DET-02': { severity: 'error', messages: ['det.frontMatterUnterminated'] },
  'DET-03': { severity: 'error', messages: ['det.commentUnterminated'] },
  'DET-04': { severity: 'error', messages: ['det.mathUnterminated'] },
  'DET-06': { severity: 'warning', messages: ['det.backtickUnmatched'] },
  'DET-07': { severity: 'warning', messages: ['det.dollarUnmatched'] },
  'DET-08': { severity: 'warning', messages: ['det.wikilinkUnclosed'] },
  'DET-09': { severity: 'warning', messages: ['det.linkDestinationUnclosed'] },
  'DET-10': { severity: 'warning', messages: ['det.tableRowRagged', 'det.tableHeaderRagged'] },
  'DET-11': { severity: 'warning', messages: ['det.listItemOrphan'] },
  'DET-12': { severity: 'warning', messages: ['det.listExcluded'] },
  'DET-13': { severity: 'error', messages: ['det.tableIncomplete', 'det.tableRowOrphan'] },
  'FM-06': { severity: 'warning', messages: ['fm.tomlPreserved'] },
  'GRT-01': {
    severity: 'error',
    messages: ['grt.regionCount', 'grt.nonBlankCount', 'grt.blockKindChanged'],
  },
  'SAFE-01': { severity: 'error', messages: ['safe.regionChanged'] },
  'TBL-01': { severity: 'info', messages: ['tbl.rowsOverCap'] },
  'TYPO-11': { severity: 'warning', messages: ['typo.unpairedQuote'] },
} as const satisfies Readonly<Record<string, Rule>>;

export type RuleId = keyof typeof RULES;

/** Every rule the formatter can report, in declaration order. */
export const RULE_IDS = Object.keys(RULES) as readonly RuleId[];

export function severityOf(ruleId: RuleId): Severity {
  return RULES[ruleId].severity;
}
