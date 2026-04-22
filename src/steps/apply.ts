import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { ParsedConfig, StepResult } from '../types.js';
import { buildTofuCommonArgs, runTofu } from '../exec/tofu.js';
import { planArtifactBaseName, resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';
import { echoFailureOutput } from '../util/echo-failure.js';

// Match the native `Apply complete!` summary line emitted by tofu at the
// end of a successful (or even partial) apply. We tolerate the variant
// with just two counters (no "imported") since older tofu releases don't
// print that token. Returns 0 for every counter if the line is absent.
const APPLY_SUMMARY_REGEX = /Apply complete! Resources:\s+(\d+)\s+added,\s+(\d+)\s+changed,\s+(\d+)\s+destroyed(?:,\s+(\d+)\s+imported)?/;

function parseApplySummary(stdout: string): {
  added: number;
  changed: number;
  destroyed: number;
  imported: number;
} {
  const match = stdout.match(APPLY_SUMMARY_REGEX);
  if (!match) {
    return { added: 0, changed: 0, destroyed: 0, imported: 0 };
  }
  return {
    added: Number(match[1]),
    changed: Number(match[2]),
    destroyed: Number(match[3]),
    imported: match[4] ? Number(match[4]) : 0,
  };
}

type TofuOutputs = Record<string, { sensitive?: boolean; type?: unknown; value?: unknown }>;

async function fetchOutputs(cwd: string): Promise<TofuOutputs> {
  const result = await runTofu(['output', '-json'], { cwd, allowFailure: true });
  if (result.exitCode !== 0) {
    return {};
  }
  try {
    return JSON.parse(result.stdout) as TofuOutputs;
  } catch {
    return {};
  }
}

function renderOutputs(outputs: TofuOutputs): string {
  const lines = Object.entries(outputs).map(([key, value]) => {
    if (value.sensitive) {
      return `- **${key}**: <sensitive>`;
    }
    const rendered =
      typeof value.value === 'string' ? value.value : JSON.stringify(value.value);
    return `- **${key}**: ${rendered}`;
  });
  return lines.length > 0 ? lines.join('\n') : 'No outputs';
}

function buildDetailBody(summaryMode: ParsedConfig['summaryMode'], outputs: TofuOutputs): string | undefined {
  if (summaryMode !== 'full') {
    return undefined;
  }
  return `### Outputs\n${renderOutputs(outputs)}\n\n_Per-resource apply lines are shown inline in the job log._`;
}

export async function runApplyStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const planName = planArtifactBaseName(config);
  const tfplanPath = `${cwd}/${planName}.tfplan`;
  const gzPath = `${tfplanPath}.gz`;
  const checksumPath = `${gzPath}.sha256`;

  if (!existsSync(tfplanPath) && !existsSync(gzPath)) {
    return createStepResult('apply', 'fail', [
      {
        check: '🚀 Tofu Apply',
        status: '❌ Fail',
        details: `Plan artifact ${planName}.tfplan.gz not found.`,
      },
    ]);
  }

  if (existsSync(gzPath)) {
    if (!existsSync(checksumPath)) {
      return createStepResult('apply', 'fail', [
        {
          check: '🚀 Tofu Apply',
          status: '❌ Fail',
          details: `Checksum file ${planName}.tfplan.gz.sha256 not found.`,
        },
      ]);
    }

    const expectedChecksum = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    const actualChecksum = createHash('sha256').update(readFileSync(gzPath)).digest('hex');
    if (!expectedChecksum || expectedChecksum !== actualChecksum) {
      return createStepResult('apply', 'fail', [
        {
          check: '🚀 Tofu Apply',
          status: '❌ Fail',
          details: `Checksum verification failed for ${planName}.tfplan.gz.`,
        },
      ]);
    }
  }

  if (!existsSync(tfplanPath)) {
    writeFileSync(tfplanPath, gunzipSync(readFileSync(gzPath)));
  }

  // Use tofu's native human-readable apply output (no -json) and stream it
  // line-by-line to the runner log so operators see the same output they'd
  // see locally. -no-color keeps ANSI sequences out of the GitHub log view,
  // which renders them as literal escape codes rather than colors.
  const result = await runTofu(
    ['apply', '-input=false', '-auto-approve', '-no-color', ...buildTofuCommonArgs(config), `${planName}.tfplan`],
    {
      cwd,
      allowFailure: true,
      onStdoutLine: (line) => {
        process.stdout.write(`${line}\n`);
      },
    },
  );

  if (result.exitCode !== 0) {
    echoFailureOutput('tofu apply', result);
  }

  const { added, changed, destroyed, imported } = parseApplySummary(result.stdout);
  const hasChanged = added > 0 || changed > 0 || destroyed > 0;
  const status = result.exitCode === 0 ? 'pass' : 'fail';

  // Fetch outputs via a separate command — dropping -json from apply means
  // we lose the structured outputs stream, but `tofu output -json` reads
  // the refreshed state and gives us the same data cleanly.
  const outputs = status === 'pass' ? await fetchOutputs(cwd) : {};

  if (existsSync(tfplanPath)) {
    unlinkSync(tfplanPath);
  }

  return createStepResult(
    'apply',
    status,
    [
      {
        check: '🚀 Tofu Apply',
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details:
          status === 'pass'
            ? `${added} added, ${changed} changed, ${destroyed} destroyed`
            : result.stderr.trim() || 'Apply failed before reporting a change summary.',
      },
    ],
    {
      details: buildDetailBody(config.summaryMode, outputs),
      metrics: {
        added,
        changed,
        destroyed,
        imported,
        forgotten: 0,
        has_changed: hasChanged,
      },
      outputs: {
        added: String(added),
        changed: String(changed),
        destroyed: String(destroyed),
        imported: String(imported),
        forgotten: '0',
        has_changed: hasChanged ? 'true' : 'false',
      },
    },
  );
}
