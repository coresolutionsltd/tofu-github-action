import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderApplyComment } from '../../src/render/apply-comment.js';
import { renderChecksComment } from '../../src/render/checks-comment.js';
import { renderPlanComment } from '../../src/render/plan-comment.js';
import type { ParsedConfig, StepResult } from '../../src/types.js';

function readSnapshot(name: string): string {
  const snapshotPath = join(process.cwd(), 'test', 'snapshots', name);
  return readFileSync(snapshotPath, 'utf8').trimEnd();
}

const config: ParsedConfig = {
  version: '1.11.2',
  workdir: '.',
  env: 'dev',
  envSlug: 'dev',
  steps: ['validate', 'plan'],
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

const steps: StepResult[] = [
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
];

describe('renderChecksComment', () => {
  it('renders a sticky marker and markdown table', () => {
    const output = renderChecksComment(config, steps);
    expect(output).toBe(readSnapshot('checks-comment.md'));
  });

  it('appends a collapsible failure block when a check step fails', () => {
    const failingSteps: StepResult[] = [
      {
        name: 'test',
        status: 'fail',
        summaryRows: [
          {
            check: '🧪 Tofu Test (Unit)',
            status: '❌ Fail',
            details: 'OpenTofu tests failed in `tests/unit`.',
          },
        ],
        details: 'assertion failed: expected 10.100.0.10, got 10.100.200.2',
      },
    ];
    const output = renderChecksComment(config, failingSteps);
    expect(output).toContain('<details><summary>🧪 Tofu Test (Unit) — failure output</summary>');
    expect(output).toContain('assertion failed: expected 10.100.0.10, got 10.100.200.2');
  });

  it('omits the failure block when a failed step has no captured details', () => {
    const failingSteps: StepResult[] = [
      {
        name: 'test',
        status: 'fail',
        summaryRows: [
          {
            check: '🧪 Tofu Test (Unit)',
            status: '❌ Fail',
            details: 'OpenTofu tests failed in `tests/unit`.',
          },
        ],
      },
    ];
    const output = renderChecksComment(config, failingSteps);
    expect(output).not.toContain('<details>');
  });
});

describe('renderPlanComment', () => {
  it('matches the golden snapshot', () => {
    const output = renderPlanComment(config, {
      status: 'pass',
      counts: {
        create: 1,
        update: 2,
        destroy: 0,
      },
    });
    expect(output).toBe(readSnapshot('plan-comment.md'));
  });
});

describe('renderApplyComment', () => {
  it('matches the golden snapshot', () => {
    const output = renderApplyComment(config, {
      status: 'pass',
      counts: {
        added: 1,
        changed: 2,
        destroyed: 0,
        imported: 0,
        forgotten: 0,
      },
    });
    expect(output).toBe(readSnapshot('apply-comment.md'));
  });
});
