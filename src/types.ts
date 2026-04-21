import type { CommentMode, SummaryMode, TofuStep, TrivyScanType } from './constants.js';

export type InputMap = Record<string, string>;

export type ParsedVar = {
  key: string;
  value: string;
};

export type ParsedConfig = {
  version: string;
  workdir: string;
  env: string;
  envSlug: string;
  steps: TofuStep[];
  tfvarFiles: string[];
  tfvars: ParsedVar[];
  backendConfigVarFiles: string[];
  backendConfigVars: ParsedVar[];
  testDir: string;
  testTfvarFiles: string[];
  testTfvars: ParsedVar[];
  tflintVersion: string;
  trivyVersion: string;
  checkovVersion: string;
  trivyScanType: TrivyScanType;
  checkovSkipChecks: string[];
  lockTimeout: string;
  parallelism: string;
  refresh?: boolean;
  targets: string[];
  artifactRetentionDays?: number;
  skipPlanUpload: boolean;
  summaryMode: SummaryMode;
  commentMode: CommentMode;
  commentIdentifier: string;
};

export type StepStatus = 'pass' | 'fail' | 'skip';

export type SummaryRow = {
  check: string;
  status: string;
  details: string;
};

// 'text' → renderer wraps in a fenced code block (right for diff-like
// tofu plan/apply/test output). 'markdown' → renderer emits verbatim
// (for structured scanner findings where a table reads cleanly).
export type DetailsFormat = 'text' | 'markdown';

export type StepResult = {
  name: TofuStep;
  status: StepStatus;
  summaryRows: SummaryRow[];
  details?: string;
  detailsFormat?: DetailsFormat;
  metrics?: Record<string, number | boolean | string>;
  outputs?: Record<string, string>;
};

export type CommentArtifacts = {
  checksBody?: string;
  planBody?: string;
  applyBody?: string;
};

export type SummaryArtifacts = {
  checksBody?: string;
  planBody?: string;
  applyBody?: string;
};

export type RuntimeArtifacts = {
  comments: CommentArtifacts;
  summaries: SummaryArtifacts;
  outputs: Record<string, string>;
  hasFailures: boolean;
};
