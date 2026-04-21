import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedConfig, StepResult } from '../types.js';
import { execFileSafe } from '../exec/process.js';
import { resolveScannerConfig } from '../exec/scanners.js';
import { resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';
import { echoFailureOutput } from '../util/echo-failure.js';

type CheckovFailedCheck = {
  check_id?: string;
  check_name?: string;
  severity?: string;
  file_path?: string;
  resource?: string;
};

// Single checkov check_type result (one scanner: terraform, secrets,
// github_actions, etc.). The top-level JSON may either be this shape or
// an array of these when multiple scanners ran.
type CheckovResult = {
  check_type?: string;
  summary?: {
    failed?: number;
    failed_checks?: number;
    failed_count?: number;
  };
  results?: {
    failed_checks?: CheckovFailedCheck[];
  };
  failed_checks?: CheckovFailedCheck[];
};

type CheckovJson = CheckovResult | CheckovResult[];

function normaliseResults(payload: CheckovJson): CheckovResult[] {
  return Array.isArray(payload) ? payload : [payload];
}

function summaryCount(summary: CheckovResult['summary']): number | undefined {
  if (summary?.failed !== undefined) return summary.failed;
  if (summary?.failed_checks !== undefined) return summary.failed_checks;
  if (summary?.failed_count !== undefined) return summary.failed_count;
  return undefined;
}

function resultFailures(result: CheckovResult): number {
  const fromSummary = summaryCount(result.summary);
  if (fromSummary !== undefined) return fromSummary;
  if (result.results?.failed_checks) return result.results.failed_checks.length;
  if (result.failed_checks) return result.failed_checks.length;
  return 0;
}

function countFailures(payload: CheckovJson): number {
  return normaliseResults(payload).reduce((total, r) => total + resultFailures(r), 0);
}

function collectFailedChecks(payload: CheckovJson): Array<CheckovFailedCheck & { check_type?: string }> {
  return normaliseResults(payload).flatMap((result) => {
    const checks = result.results?.failed_checks ?? result.failed_checks ?? [];
    return checks.map((check) => ({ ...check, check_type: result.check_type }));
  });
}

function formatDetails(payload: CheckovJson): string {
  const checks = collectFailedChecks(payload);
  if (checks.length === 0) {
    return 'Checkov findings available in checkov_output.json.';
  }

  return checks
    .map((check) => {
      const severity = check.severity && check.severity !== 'UNKNOWN' ? `[${check.severity}] ` : '';
      const scanner = check.check_type ? `[${check.check_type}] ` : '';
      const location = check.file_path
        ? ` (${check.file_path}${check.resource ? `, ${check.resource}` : ''})`
        : '';
      return `- ${scanner}${severity}${check.check_id ?? 'UNKNOWN'}: ${check.check_name ?? 'Issue'}${location}`;
    })
    .join('\n');
}

export function resolveCheckovJsonPath(outputPath: string): string | null {
  if (!existsSync(outputPath)) {
    return null;
  }

  try {
    if (statSync(outputPath).isDirectory()) {
      const nestedPath = join(outputPath, 'results_json.json');
      return existsSync(nestedPath) ? nestedPath : null;
    }
  } catch {
    return null;
  }

  return outputPath;
}

export function loadCheckovJson(outputPath: string): CheckovJson | null {
  const jsonPath = resolveCheckovJsonPath(outputPath);
  if (!jsonPath) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(jsonPath, 'utf8')) as CheckovJson;
  } catch {
    return null;
  }
}

export async function runCheckovStep(config: ParsedConfig): Promise<StepResult> {
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
      'checkov',
      'skip',
      [
        {
          check: '🔐 Checkov',
          status: '⚠️ Skipped',
          details: 'No Terraform/OpenTofu files found to scan.',
        },
      ],
      {
        outputs: {
          checkov_ran: 'false',
          checkov_skipped: 'true',
          checkov_failed: 'false',
          checkov_issue_count: '0',
          checkov_details: 'No Terraform/OpenTofu files found to scan.',
        },
      },
    );
  }

  const configPath = resolveScannerConfig(cwd, workspace, actionPath, '.checkov.yaml');
  const outputPath = join(cwd, 'checkov_output');
  const args = ['-d', '.', '--output', 'json', '--output-file-path', outputPath, '--skip-download'];

  if (configPath) {
    args.push('--config-file', configPath);
  }

  if (config.checkovSkipChecks.length > 0) {
    args.push('--skip-check', config.checkovSkipChecks.join(','));
  }

  const result = await execFileSafe('checkov', args, { cwd, allowFailure: true });
  const payload = loadCheckovJson(outputPath);
  if (!payload) {
    echoFailureOutput('checkov', result);
    const details = result.stderr.trim() || result.stdout.trim() || 'Checkov scan failed before producing Checkov JSON output.';
    return createStepResult(
      'checkov',
      'fail',
      [
        {
          check: '🔐 Checkov',
          status: '❌ Fail',
          details,
        },
      ],
      {
        details,
        outputs: {
          checkov_ran: 'true',
          checkov_skipped: 'false',
          checkov_failed: 'true',
          checkov_issue_count: '0',
          checkov_details: details,
        },
      },
    );
  }

  const issueCount = countFailures(payload);
  const status = result.exitCode === 0 ? 'pass' : 'fail';
  if (status === 'fail') {
    // stderr of checkov is usually just the external-module warning; the
    // actionable findings live inside the JSON payload. Echo both so
    // operators see the scanner output AND the per-check breakdown
    // inline in the runner log.
    echoFailureOutput('checkov', result);
    const findings = formatDetails(payload);
    if (findings && findings !== 'Checkov findings available in checkov_output.json.') {
      process.stdout.write(`\n----- checkov findings (${issueCount}) -----\n${findings}\n----- end checkov findings -----\n`);
    }
  }
  const details =
    status === 'pass'
      ? `${issueCount} issue(s) found.`
      : issueCount > 0
        ? `${issueCount} issue(s) found.`
        : 'Checkov scan failed before reporting results.';

  return createStepResult(
    'checkov',
    status,
    [
      {
        check: '🔐 Checkov',
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details,
      },
    ],
    {
      details: issueCount > 0 ? formatDetails(payload) : undefined,
      outputs: {
        checkov_ran: 'true',
        checkov_skipped: 'false',
        checkov_failed: status === 'fail' ? 'true' : 'false',
        checkov_issue_count: String(issueCount),
        checkov_details: details,
      },
    },
  );
}
