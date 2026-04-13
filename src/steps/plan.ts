import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { ParsedConfig, StepResult } from '../types.js';
import { buildPlanArgs, buildVarArgs, runTofu } from '../exec/tofu.js';
import { planArtifactBaseName, resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';

type PlanJson = {
  resource_changes?: Array<{
    change?: {
      actions?: string[];
    };
  }>;
};

function countActions(payload: PlanJson, action: string): number {
  return (payload.resource_changes ?? []).filter((resource) => resource.change?.actions?.includes(action)).length;
}

export async function runPlanStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const planName = planArtifactBaseName(config);
  const tfplanPath = `${cwd}/${planName}.tfplan`;
  const gzPath = `${tfplanPath}.gz`;
  const checksumPath = `${gzPath}.sha256`;

  const plan = await runTofu(
    ['plan', ...buildVarArgs(config), ...buildPlanArgs(config), '-input=false', '-out', `${planName}.tfplan`],
    { cwd, allowFailure: true },
  );

  if (plan.exitCode !== 0) {
    return createStepResult(
      'plan',
      'fail',
      [
        {
          check: '🏗️ Tofu Plan',
          status: '❌ Fail',
          details: plan.stderr.trim() || plan.stdout.trim() || 'Plan failed before producing a plan file.',
        },
      ],
      {
        details: plan.stderr.trim() || plan.stdout.trim() || undefined,
      },
    );
  }

  if (!existsSync(tfplanPath)) {
    return createStepResult(
      'plan',
      'fail',
      [
        {
          check: '🏗️ Tofu Plan',
          status: '❌ Fail',
          details: `Plan completed without producing ${planName}.tfplan.`,
        },
      ],
    );
  }

  const shownPlan = config.summaryMode === 'full'
    ? await runTofu(['show', '-no-color', `${planName}.tfplan`], { cwd, allowFailure: true })
    : null;
  if (shownPlan && shownPlan.exitCode !== 0) {
    return createStepResult(
      'plan',
      'fail',
      [
        {
          check: '🏗️ Tofu Plan',
          status: '❌ Fail',
          details: shownPlan.stderr.trim() || shownPlan.stdout.trim() || 'Failed to render the generated plan.',
        },
      ],
      {
        details: shownPlan.stderr.trim() || shownPlan.stdout.trim() || undefined,
      },
    );
  }

  const shownJson = await runTofu(['show', '-json', `${planName}.tfplan`], { cwd, allowFailure: true });
  if (shownJson.exitCode !== 0) {
    return createStepResult(
      'plan',
      'fail',
      [
        {
          check: '🏗️ Tofu Plan',
          status: '❌ Fail',
          details: shownJson.stderr.trim() || shownJson.stdout.trim() || 'Failed to read the generated plan JSON.',
        },
      ],
      {
        details: shownJson.stderr.trim() || shownJson.stdout.trim() || undefined,
      },
    );
  }

  let payload: PlanJson;
  try {
    payload = JSON.parse(shownJson.stdout || '{}') as PlanJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createStepResult(
      'plan',
      'fail',
      [
        {
          check: '🏗️ Tofu Plan',
          status: '❌ Fail',
          details: `Failed to parse generated plan JSON: ${message}`,
        },
      ],
      {
        details: shownJson.stdout.trim() || undefined,
      },
    );
  }

  writeFileSync(gzPath, gzipSync(readFileSync(tfplanPath), { level: 9 }));
  const planArchive = readFileSync(gzPath);
  const planDigest = createHash('sha256').update(planArchive).digest('hex');
  writeFileSync(checksumPath, `${planDigest}  ${planName}.tfplan.gz\n`);

  const createCount = countActions(payload, 'create');
  const updateCount = countActions(payload, 'update');
  const destroyCount = countActions(payload, 'delete');
  const hasChanges = createCount > 0 || updateCount > 0 || destroyCount > 0;

  return createStepResult(
    'plan',
    'pass',
    [
      {
        check: '🏗️ Tofu Plan',
        status: '✅ Pass',
        details: `${createCount} create, ${updateCount} update, ${destroyCount} destroy`,
      },
    ],
    {
      details: shownPlan?.stdout,
      metrics: {
        create: createCount,
        update: updateCount,
        destroy: destroyCount,
        has_changes: hasChanges,
      },
      outputs: {
        has_changes: hasChanges ? 'true' : 'false',
        create_count: String(createCount),
        update_count: String(updateCount),
        destroy_count: String(destroyCount),
        plan_artifact_name: `${planName}.tfplan.gz`,
        plan_artifact_sha256: planDigest,
      },
    },
  );
}
