/**
 * CFG-02: every rule has a stable id.
 *
 * Severity is written where each rule raises its diagnostic, which is what
 * CFG-02 asks of it: a rule's severity is a property of the rule, not a setting.
 * What this module owns is the inventory - which rules exist - so a diagnostic
 * cannot name a rule that does not, and a test can walk the list instead of
 * discovering it rule by rule.
 *
 * Spec references: CFG-02.
 */

/** Every rule the formatter can report. */
export const RULE_IDS = [
  'DET-01',
  'DET-02',
  'DET-03',
  'DET-04',
  'DET-06',
  'DET-07',
  'DET-08',
  'DET-09',
  'DET-10',
  'DET-11',
  'DET-12',
  'DET-13',
  'GRT-01',
  'SAFE-01',
  'TBL-01',
  'TYPO-11',
] as const;

export type RuleId = (typeof RULE_IDS)[number];
