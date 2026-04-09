import { describe, expect, it } from 'vitest';
import { runMain } from '../../src/main.js';
import type { ParsedConfig, StepResult } from '../../src/types.js';

const config: ParsedConfig = {
  version: '1.11.2',
  workdir: '.',
  env: 'dev',
  envSlug: 'dev',
  steps: ['validate', 'plan', 'apply'],
  tfvarFiles: [],
  tfvars: [],
  backendConfigVarFiles: [],
  backendConfigVars: [],
  testDir: 'tests',
  testTfvarFiles: [],
  testTfvars: [],
  tflintVersion: '0.55.1',
  trivyVersion: '0.69.3',
  checkovVersion: '3.2.497',
  trivyScanType: 'config',
  checkovSkipChecks: [],
  lockTimeout: '',
  parallelism: '',
  refresh: undefined,
  targets: [],
  artifactRetentionDays: undefined,
  skipPlanUpload: true,
  summaryMode: 'redacted',
  commentMode: 'sticky',
  commentIdentifier: 'tf-github-action',
};

describe('runMain', () => {
  it('produces checks, plan, and apply artifacts plus outputs', () => {
    const results: StepResult[] = [
      {
        name: 'validate',
        status: 'pass',
        summaryRows: [
          {
            check: '🎯 Tofu Format',
            status: '✅ Pass',
            details: 'All files are properly formatted',
          },
          {
            check: '🔍 Tofu Validate',
            status: '✅ Pass',
            details: 'Configuration is valid',
          },
        ],
      },
      {
        name: 'plan',
        status: 'pass',
        summaryRows: [
          {
            check: '🏗️ Tofu Plan',
            status: '✅ Pass',
            details: '1 create, 2 update, 0 destroy',
          },
        ],
        metrics: {
          create: 1,
          update: 2,
          destroy: 0,
        },
      },
      {
        name: 'apply',
        status: 'pass',
        summaryRows: [
          {
            check: '🚀 Tofu Apply',
            status: '✅ Pass',
            details: '1 added, 2 changed, 0 destroyed',
          },
        ],
        metrics: {
          added: 1,
          changed: 2,
          destroyed: 0,
          imported: 0,
          forgotten: 0,
        },
      },
    ];

    const artifacts = runMain(config, results);

    expect(artifacts.comments.checksBody).toContain('### 🧪 Tofu Checks (dev)');
    expect(artifacts.comments.planBody).toContain('### 🏗️ Tofu Plan (dev)');
    expect(artifacts.comments.applyBody).toContain('### 🚀 Tofu Apply (dev)');
    expect(artifacts.summaries.checksBody).toContain('## 🧪 Tofu Checks (dev)');
    expect(artifacts.outputs.validate_status).toBe('pass');
    expect(artifacts.outputs.plan_status).toBe('pass');
    expect(artifacts.outputs.apply_status).toBe('pass');
    expect(artifacts.outputs.has_failures).toBe('false');
    expect(artifacts.hasFailures).toBe(false);
  });

  it('renders blocked plan and apply steps explicitly', () => {
    const results: StepResult[] = [
      {
        name: 'validate',
        status: 'fail',
        summaryRows: [
          {
            check: '🔍 Tofu Validate',
            status: '❌ Fail',
            details: 'Provider configuration is invalid',
          },
        ],
      },
      {
        name: 'plan',
        status: 'skip',
        summaryRows: [
          {
            check: '🏗️ Tofu Plan',
            status: '⚠️ Skipped',
            details: 'Blocked because a previous check step failed.',
          },
        ],
      },
      {
        name: 'apply',
        status: 'skip',
        summaryRows: [
          {
            check: '🚀 Tofu Apply',
            status: '⚠️ Skipped',
            details: 'Blocked because a previous check step failed.',
          },
        ],
      },
    ];

    const artifacts = runMain(config, results);

    expect(artifacts.comments.planBody).toContain('**Status:** ⚠️ Skipped');
    expect(artifacts.comments.applyBody).toContain('**Status:** ⚠️ Skipped');
    expect(artifacts.outputs.plan_status).toBe('skip');
    expect(artifacts.outputs.apply_status).toBe('skip');
  });
});
