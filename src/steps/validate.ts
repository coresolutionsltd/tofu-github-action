import type { ParsedConfig, StepResult } from '../types.js';
import { buildVarArgs, runTofu } from '../exec/tofu.js';
import { resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';
import { echoFailureOutput } from '../util/echo-failure.js';

type ValidateJson = {
  valid?: boolean;
  error_count?: number;
  diagnostics?: Array<{
    summary?: string;
  }>;
};

function summariseDiagnostics(payload: ValidateJson): string {
  const summaries = (payload.diagnostics ?? [])
    .map((item) => item.summary?.trim())
    .filter((value): value is string => Boolean(value));

  if (summaries.length === 0) {
    return `${payload.error_count ?? 0} validation error(s)`;
  }

  const counts = new Map<string, number>();
  for (const summary of summaries) {
    counts.set(summary, (counts.get(summary) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([summary, count]) => `${count} ${summary.toLowerCase()}${count === 1 ? '' : 's'}`)
    .join(', ');
}

export async function runValidateStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const fmtDiff = await runTofu(['fmt', '-check', '-diff', '-no-color'], { cwd, allowFailure: true });
  const validate = await runTofu(['validate', ...buildVarArgs(config), '-json'], { cwd, allowFailure: true });
  const payload = JSON.parse(validate.stdout || '{}') as ValidateJson;

  const fmtSummary = fmtDiff.stdout.trim().split('\n').map((line) => line.trim()).filter(Boolean).join(' ');
  const fmtFailed = fmtSummary.length > 0 || fmtDiff.exitCode !== 0;
  const validateFailed = validate.exitCode !== 0 || payload.valid !== true;
  const status = fmtFailed || validateFailed ? 'fail' : 'pass';
  if (fmtFailed) {
    echoFailureOutput('tofu fmt', fmtDiff);
  }
  if (validateFailed) {
    echoFailureOutput('tofu validate', validate);
  }
  const validateSummary = validateFailed ? summariseDiagnostics(payload) : 'Configuration is valid';

  return createStepResult(
    'validate',
    status,
    [
      {
        check: '🎯 Tofu Format',
        status: fmtFailed ? '❌ Fail' : '✅ Pass',
        details: fmtFailed ? `\`${fmtSummary || 'Formatting issues detected'}\`` : 'All files are properly formatted',
      },
      {
        check: '🔍 Tofu Validate',
        status: validateFailed ? '❌ Fail' : '✅ Pass',
        details: validateSummary,
      },
    ],
    {
      outputs: {
        fmt_failed: fmtFailed ? 'true' : 'false',
        fmt_summary: fmtSummary,
        validate_failed: validateFailed ? 'true' : 'false',
        validate_summary: validateSummary,
      },
    },
  );
}
