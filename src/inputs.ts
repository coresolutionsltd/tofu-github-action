import {
  ALL_STEPS,
  COMMENT_MODES,
  DEFAULT_STEPS,
  SUMMARY_MODES,
  TRIVY_SCAN_TYPES,
  type CommentMode,
  type SummaryMode,
  type TofuStep,
  type TrivyScanType,
} from './constants.js';
import type { InputMap, ParsedConfig, ParsedVar } from './types.js';
import { InputValidationError } from './util/errors.js';
import { sanitizeEnvSlug } from './util/sanitize.js';

function inputValue(inputs: InputMap, key: string): string {
  return inputs[key] ?? '';
}

function splitStepInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitDelimited(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBoolean(input: string, field: string): boolean {
  if (input === 'true') {
    return true;
  }
  if (input === 'false') {
    return false;
  }
  throw new InputValidationError(`${field} must be 'true' or 'false'`);
}

function parseOptionalBoolean(input: string, field: string): boolean | undefined {
  if (!input.trim()) {
    return undefined;
  }
  return parseBoolean(input, field);
}

function parseEnum<T extends string>(input: string, values: readonly T[], field: string, fallback: T): T {
  const candidate = input.trim() || fallback;
  if (!values.includes(candidate as T)) {
    throw new InputValidationError(`${field} must be one of: ${values.join(', ')}`);
  }
  return candidate as T;
}

function parseSteps(input: string): TofuStep[] {
  const requested = splitStepInput(input);
  const effective = requested.length === 0 ? [...DEFAULT_STEPS] : requested;
  const seen = new Set<TofuStep>();

  for (const step of effective) {
    if (!ALL_STEPS.includes(step as TofuStep)) {
      throw new InputValidationError(`Unknown step: ${step}`);
    }
    seen.add(step as TofuStep);
  }

  return [...seen];
}

function parseVars(input: string, field: string): ParsedVar[] {
  if (!input.trim()) {
    return [];
  }

  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        throw new InputValidationError(`${field} entries must use key=value format`);
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1);
      if (!key) {
        throw new InputValidationError(`${field} entries must include a key`);
      }

      return { key, value };
    });
}

function parseOptionalNumber(input: string, field: string): number | undefined {
  if (!input.trim()) {
    return undefined;
  }

  if (!/^\d+$/.test(input.trim())) {
    throw new InputValidationError(`${field} must be a number`);
  }

  return Number(input.trim());
}

export function parseInputs(inputs: InputMap): ParsedConfig {
  const version = inputValue(inputs, 'version');
  const workdir = inputValue(inputs, 'workdir');
  const env = inputValue(inputs, 'env').trim();
  const steps = inputValue(inputs, 'steps');
  const tfvarFiles = inputValue(inputs, 'tfvar-files');
  const tfvars = inputValue(inputs, 'tfvars');
  const backendConfigVarFiles = inputValue(inputs, 'backend-config-var-files');
  const backendConfigVars = inputValue(inputs, 'backend-config-vars');
  const testDir = inputValue(inputs, 'test-dir');
  const testTfvarFiles = inputValue(inputs, 'test-tfvar-files');
  const testTfvars = inputValue(inputs, 'test-tfvars');
  const tflintVersion = inputValue(inputs, 'tflint-version');
  const trivyVersion = inputValue(inputs, 'trivy-version');
  const checkovVersion = inputValue(inputs, 'checkov-version');
  const trivyScanType = inputValue(inputs, 'trivy-scan-type');
  const checkovSkipChecks = inputValue(inputs, 'checkov-skip-checks');
  const lockTimeout = inputValue(inputs, 'lock-timeout');
  const parallelism = inputValue(inputs, 'parallelism');
  const refresh = inputValue(inputs, 'refresh');
  const targets = inputValue(inputs, 'targets');
  const artifactRetentionDaysInput = inputValue(inputs, 'artifact-retention-days');
  const skipPlanUpload = inputValue(inputs, 'skip-plan-upload');
  const summaryMode = inputValue(inputs, 'summary-mode');
  const commentMode = inputValue(inputs, 'comment-mode');
  const commentIdentifier = inputValue(inputs, 'comment-identifier');

  const artifactRetentionDays = parseOptionalNumber(artifactRetentionDaysInput, 'artifact-retention-days');

  if (artifactRetentionDays !== undefined && (artifactRetentionDays < 1 || artifactRetentionDays > 90)) {
    throw new InputValidationError('artifact-retention-days must be between 1 and 90');
  }

  const parsedTfvarFiles = splitDelimited(tfvarFiles);
  const parsedTfvars = parseVars(tfvars, 'tfvars');
  const parsedTestTfvarFiles = splitDelimited(testTfvarFiles);
  const parsedTestTfvars = parseVars(testTfvars, 'test-tfvars');

  return {
    version: version.trim() || '1.11.2',
    workdir: workdir.trim() || '.',
    env,
    envSlug: sanitizeEnvSlug(env),
    steps: parseSteps(steps),
    tfvarFiles: parsedTfvarFiles,
    tfvars: parsedTfvars,
    backendConfigVarFiles: splitDelimited(backendConfigVarFiles),
    backendConfigVars: parseVars(backendConfigVars, 'backend-config-vars'),
    testDir: testDir.trim() || 'tests',
    testTfvarFiles: parsedTestTfvarFiles.length > 0 ? parsedTestTfvarFiles : parsedTfvarFiles,
    testTfvars: parsedTestTfvars.length > 0 ? parsedTestTfvars : parsedTfvars,
    tflintVersion: tflintVersion.trim() || '0.55.1',
    trivyVersion: trivyVersion.trim() || '0.69.3',
    checkovVersion: checkovVersion.trim() || '3.2.497',
    trivyScanType: parseEnum<TrivyScanType>(trivyScanType, TRIVY_SCAN_TYPES, 'trivy-scan-type', 'config'),
    checkovSkipChecks: splitDelimited(checkovSkipChecks),
    lockTimeout: lockTimeout.trim(),
    parallelism: parallelism.trim(),
    refresh: parseOptionalBoolean(refresh, 'refresh'),
    targets: splitDelimited(targets),
    artifactRetentionDays,
    skipPlanUpload: parseBoolean(skipPlanUpload.trim() || 'false', 'skip-plan-upload'),
    summaryMode: parseEnum<SummaryMode>(summaryMode, SUMMARY_MODES, 'summary-mode', 'redacted'),
    commentMode: parseEnum<CommentMode>(commentMode, COMMENT_MODES, 'comment-mode', 'sticky'),
    commentIdentifier: commentIdentifier.trim() || 'tf-github-action',
  };
}
