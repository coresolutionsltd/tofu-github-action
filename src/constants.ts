export const ACTION_NAME = 'Tofu GitHub Action';

export const ALL_STEPS = [
  'validate',
  'plan',
  'apply',
  'test',
  'lint',
  'trivy',
  'checkov',
] as const;

export const DEFAULT_STEPS: ReadonlyArray<TofuStep> = ['validate', 'plan'];
export const EXECUTION_ORDER: ReadonlyArray<TofuStep> = [
  'validate',
  'lint',
  'trivy',
  'checkov',
  'test',
  'plan',
  'apply',
];

export const SUMMARY_MODES = ['full', 'redacted', 'off'] as const;
export const COMMENT_MODES = ['sticky', 'off'] as const;
export const TRIVY_SCAN_TYPES = ['config', 'fs'] as const;

export type TofuStep = (typeof ALL_STEPS)[number];
export type SummaryMode = (typeof SUMMARY_MODES)[number];
export type CommentMode = (typeof COMMENT_MODES)[number];
export type TrivyScanType = (typeof TRIVY_SCAN_TYPES)[number];
