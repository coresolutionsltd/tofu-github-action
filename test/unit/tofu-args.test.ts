import { describe, expect, it } from 'vitest';
import {
  buildBackendConfigArgs,
  buildPlanArgs,
  buildTofuCommonArgs,
  buildVarArgs,
} from '../../src/exec/tofu.js';
import type { ParsedConfig } from '../../src/types.js';

const base: ParsedConfig = {
  version: '1.11.2',
  workdir: '.',
  env: 'dev',
  envSlug: 'dev',
  steps: ['plan'],
  tfvarFiles: ['dev.tfvars'],
  tfvars: [{ key: 'region', value: 'eu-west-1' }],
  backendConfigVarFiles: ['backend.hcl'],
  backendConfigVars: [{ key: 'bucket', value: 'my-state' }],
  testDir: 'tests',
  testTfvarFiles: ['test.tfvars'],
  testTfvars: [{ key: 'mode', value: 'unit' }],
  tflintVersion: '0.55.1',
  trivyVersion: '0.69.3',
  checkovVersion: '3.2.497',
  trivyScanType: 'config',
  checkovSkipChecks: [],
  lockTimeout: '5m',
  parallelism: '10',
  refresh: false,
  targets: ['aws_s3_bucket.this', 'aws_iam_role.that'],
  artifactRetentionDays: undefined,
  skipPlanUpload: true,
  summaryMode: 'redacted',
  commentMode: 'off',
  commentIdentifier: 'tf',
};

describe('buildVarArgs', () => {
  it('builds default scope var and var-file args', () => {
    expect(buildVarArgs(base)).toEqual(['-var-file=dev.tfvars', '-var=region=eu-west-1']);
  });

  it('switches to test scope inputs when requested', () => {
    expect(buildVarArgs(base, 'test')).toEqual(['-var-file=test.tfvars', '-var=mode=unit']);
  });
});

describe('buildBackendConfigArgs', () => {
  it('includes both backend files and inline backend vars', () => {
    expect(buildBackendConfigArgs(base)).toEqual([
      '-backend-config=backend.hcl',
      '-backend-config=bucket=my-state',
    ]);
  });
});

describe('buildTofuCommonArgs', () => {
  it('emits lock-timeout and parallelism when provided', () => {
    expect(buildTofuCommonArgs(base)).toEqual(['-lock-timeout=5m', '-parallelism=10']);
  });

  it('omits flags when empty', () => {
    expect(buildTofuCommonArgs({ ...base, lockTimeout: '', parallelism: '' })).toEqual([]);
  });
});

describe('buildPlanArgs', () => {
  it('includes refresh flag and each target', () => {
    expect(buildPlanArgs(base)).toEqual([
      '-lock-timeout=5m',
      '-parallelism=10',
      '-refresh=false',
      '-target=aws_s3_bucket.this',
      '-target=aws_iam_role.that',
    ]);
  });

  it('omits refresh when undefined', () => {
    expect(buildPlanArgs({ ...base, refresh: undefined, targets: [] })).toEqual([
      '-lock-timeout=5m',
      '-parallelism=10',
    ]);
  });
});
