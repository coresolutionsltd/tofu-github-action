import type { InputMap } from './types.js';

const INPUT_KEYS = [
  'version',
  'workdir',
  'env',
  'steps',
  'tfvar-files',
  'tfvars',
  'backend-config-var-files',
  'backend-config-vars',
  'test-dir',
  'test-tfvar-files',
  'test-tfvars',
  'tflint-version',
  'trivy-version',
  'checkov-version',
  'trivy-scan-type',
  'checkov-skip-checks',
  'lock-timeout',
  'parallelism',
  'refresh',
  'targets',
  'artifact-retention-days',
  'skip-plan-upload',
  'summary-mode',
  'comment-mode',
  'comment-identifier',
] as const;

function envKeyForInput(name: string): string {
  return `INPUT_${name.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`;
}

export function getActionInputMap(): InputMap {
  const entries = INPUT_KEYS.map((key) => [key, process.env[envKeyForInput(key)] ?? '']);
  return Object.fromEntries(entries);
}
