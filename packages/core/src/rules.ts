/**
 * CFG-02: every rule has a stable id and its own severity.
 *
 * The severity is a property of the rule, not a setting, so it is declared here
 * once rather than typed at each of the places a rule reports something. Two
 * call sites of one rule can no longer disagree about whether the document is
 * refused, and a diagnostic cannot name a rule that does not exist.
 *
 * Spec references: CFG-02.
 */

/** The three levels a rule can be reported at. */
export const SEVERITIES = ['error', 'warning', 'info'] as const;

export type Severity = (typeof SEVERITIES)[number];

/**
 * Every rule the formatter can report, and the level it is reported at.
 *
 * An error refuses the document and returns the input unchanged; a warning
 * formats it and says what wants a look; a note reports what the formatter did
 * rather than anything wrong with the document.
 */
export const RULE_SEVERITY = {
  'DET-01': 'error',
  'DET-02': 'error',
  'DET-03': 'error',
  'DET-04': 'error',
  'DET-06': 'warning',
  'DET-07': 'warning',
  'DET-08': 'warning',
  'DET-09': 'warning',
  'DET-10': 'warning',
  'DET-11': 'warning',
  'DET-12': 'warning',
  'DET-13': 'error',
  'GRT-01': 'error',
  'SAFE-01': 'error',
  'TBL-01': 'info',
  'TYPO-11': 'warning',
} as const satisfies Readonly<Record<string, Severity>>;

export type RuleId = keyof typeof RULE_SEVERITY;

/** Every rule the formatter can report, in declaration order. */
export const RULE_IDS = Object.keys(RULE_SEVERITY) as readonly RuleId[];

export function severityOf(ruleId: RuleId): Severity {
  return RULE_SEVERITY[ruleId];
}
