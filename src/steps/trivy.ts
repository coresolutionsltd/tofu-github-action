import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedConfig, StepResult } from '../types.js';
import { execFileSafe } from '../exec/process.js';
import { resolveScannerConfig } from '../exec/scanners.js';
import { resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';

type TrivyJson = {
  Results?: Array<{
    Misconfigurations?: Array<{
      Status?: string;
      Severity?: string;
      ID?: string;
      Title?: string;
      CauseMetadata?: {
        Resource?: string;
      };
    }>;
  }>;
};

function countFailures(payload: TrivyJson): number {
  return (payload.Results ?? [])
    .flatMap((result) => result.Misconfigurations ?? [])
    .filter((item) => item.Status === 'FAIL').length;
}

function formatDetails(payload: TrivyJson): string {
  const issues = (payload.Results ?? [])
    .flatMap((result) => result.Misconfigurations ?? [])
    .filter((item) => item.Status === 'FAIL')
    .map((item) => {
      const resource = item.CauseMetadata?.Resource ? ` (${item.CauseMetadata.Resource})` : '';
      return `- [${item.Severity ?? 'UNKNOWN'}] ${item.ID ?? 'UNKNOWN'}: ${item.Title ?? 'Issue'}${resource}`;
    });

  return issues.length > 0 ? issues.join('\n') : 'Trivy findings available in trivy_output.json.';
}

function loadTrivyJson(outputPath: string): TrivyJson | null {
  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(outputPath, 'utf8')) as TrivyJson;
  } catch {
    return null;
  }
}

export async function runTrivyStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const workspace = process.env.GITHUB_WORKSPACE || process.cwd();
  const actionPath = process.env.GITHUB_ACTION_PATH || process.cwd();
  const tfFiles = await execFileSafe(
    'find',
    ['.', '(', '-name', '*.tf', '-o', '-name', '*.tf.json', '-o', '-name', '*.tfvars', '-o', '-name', '*.tfvars.json', ')', '-print', '-quit'],
    { cwd, allowFailure: true },
  );

  if (!tfFiles.stdout.trim()) {
    return createStepResult(
      'trivy',
      'skip',
      [
        {
          check: '🛡️ Trivy',
          status: '⚠️ Skipped',
          details: 'No Terraform/OpenTofu files found to scan.',
        },
      ],
      {
        outputs: {
          trivy_ran: 'false',
          trivy_skipped: 'true',
          trivy_failed: 'false',
          trivy_issue_count: '0',
          trivy_details: 'No Terraform/OpenTofu files found to scan.',
        },
      },
    );
  }

  const configPath = resolveScannerConfig(cwd, workspace, actionPath, '.trivy.yaml');
  const outputPath = join(cwd, 'trivy_output.json');
  const commandArgs = [
    config.trivyScanType,
    '--format',
    'json',
    '--output',
    outputPath,
    '--exit-code',
    '1',
  ];

  if (configPath) {
    commandArgs.push('--config', configPath);
  }

  commandArgs.push(config.trivyScanType === 'config' ? '.' : '.');

  const result = await execFileSafe('trivy', commandArgs, { cwd, allowFailure: true });
  const payload = loadTrivyJson(outputPath);
  if (!payload) {
    const details = result.stderr.trim() || result.stdout.trim() || 'Trivy scan failed before producing trivy_output.json.';
    return createStepResult(
      'trivy',
      'fail',
      [
        {
          check: '🛡️ Trivy',
          status: '❌ Fail',
          details,
        },
      ],
      {
        details,
        outputs: {
          trivy_ran: 'true',
          trivy_skipped: 'false',
          trivy_failed: 'true',
          trivy_issue_count: '0',
          trivy_details: details,
        },
      },
    );
  }

  const issueCount = countFailures(payload);
  const status = result.exitCode === 0 ? 'pass' : 'fail';
  const details =
    status === 'pass'
      ? `${issueCount} issue(s) found.`
      : issueCount > 0
        ? `${issueCount} issue(s) found.`
        : 'Trivy scan failed before reporting results.';

  return createStepResult(
    'trivy',
    status,
    [
      {
        check: '🛡️ Trivy',
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details,
      },
    ],
    {
      details: issueCount > 0 ? formatDetails(payload) : undefined,
      outputs: {
        trivy_ran: 'true',
        trivy_skipped: 'false',
        trivy_failed: status === 'fail' ? 'true' : 'false',
        trivy_issue_count: String(issueCount),
        trivy_details: details,
      },
    },
  );
}
