import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedConfig, StepResult } from '../types.js';
import { execFileSafe } from '../exec/process.js';
import { resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';
import { echoFailureOutput } from '../util/echo-failure.js';

function resolveTflintConfig(cwd: string): string | null {
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const actionPath = process.env.GITHUB_ACTION_PATH || process.cwd();
  const candidates = [
    join(cwd, '.tflint.hcl'),
    join(workspace, '.tflint.hcl'),
    join(actionPath, '.tflint.hcl'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function countIssues(output: string): number {
  const match = output.match(/([0-9]+) (?:issue|issues)\(s\)? found/);
  if (match?.[1]) {
    return Number(match[1]);
  }

  const bySeverity = output
    .split('\n')
    .filter((line) => /^(Warning|Error|Notice):/.test(line.trim()))
    .length;

  return bySeverity;
}

export async function runLintStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const tfFiles = await execFileSafe('find', ['.', '-name', '*.tf', '-print', '-quit'], { cwd, allowFailure: true });

  if (!tfFiles.stdout.trim()) {
    return createStepResult(
      'lint',
      'skip',
      [
        {
          check: '🧹 TFLint',
          status: '⚠️ Skipped',
          details: 'No Terraform/OpenTofu files found to lint.',
        },
      ],
      {
        outputs: {
          lint_ran: 'false',
          lint_skipped: 'true',
          lint_failed: 'false',
          lint_issue_count: '0',
          lint_details: 'No Terraform/OpenTofu files found to lint.',
        },
      },
    );
  }

  const configPath = resolveTflintConfig(cwd);
  const configArgs = configPath ? ['--config', configPath] : [];

  let initExit = 0;
  if (configPath) {
    const init = await execFileSafe('tflint', [...configArgs, '--init'], { cwd, allowFailure: true });
    initExit = init.exitCode;
  }

  const lint = await execFileSafe('tflint', configArgs, { cwd, allowFailure: true });
  const issueCount = countIssues(lint.stdout || lint.stderr);
  const lintExit = initExit !== 0 ? initExit : lint.exitCode;
  const status = lintExit === 0 ? 'pass' : 'fail';
  if (status === 'fail') {
    echoFailureOutput('tflint', lint);
  }
  const details =
    status === 'pass'
      ? `${issueCount} issue(s) found.`
      : issueCount > 0
        ? `${issueCount} issue(s) found.`
        : 'TFLint failed before reporting results.';

  return createStepResult(
    'lint',
    status,
    [
      {
        check: '🧹 TFLint',
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details,
      },
    ],
    {
      details: status === 'fail' ? (lint.stdout || lint.stderr).trim() : undefined,
      outputs: {
        lint_ran: 'true',
        lint_skipped: 'false',
        lint_failed: status === 'fail' ? 'true' : 'false',
        lint_issue_count: String(issueCount),
        lint_details: details,
      },
    },
  );
}
