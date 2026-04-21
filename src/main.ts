import * as core from '@actions/core';
import { getActionInputMap } from './action-inputs.js';
import { EXECUTION_ORDER } from './constants.js';
import type { ParsedConfig, RuntimeArtifacts, StepResult } from './types.js';
import { syncStickyComments } from './github/comments.js';
import { renderApplyComment } from './render/apply-comment.js';
import { renderApplySummary } from './render/apply-summary.js';
import { renderChecksComment } from './render/checks-comment.js';
import { renderChecksSummary } from './render/checks-summary.js';
import { renderPlanComment } from './render/plan-comment.js';
import { renderPlanSummary } from './render/plan-summary.js';
import { createBaseOutputs, mergeStepOutputs } from './outputs.js';
import { parseInputs } from './inputs.js';
import { appendStepSummary } from './util/summary.js';
import { assertWorkdirExists } from './util/paths.js';
import { registerConfigSecrets } from './util/register-secrets.js';
import { runInit } from './steps/init.js';
import { runValidateStep } from './steps/validate.js';
import { runPlanStep } from './steps/plan.js';
import { runApplyStep } from './steps/apply.js';
import { runLintStep } from './steps/lint.js';
import { runTrivyStep } from './steps/trivy.js';
import { runCheckovStep } from './steps/checkov.js';
import { runTestStep } from './steps/test.js';

function metricNumber(step: StepResult | undefined, key: string): number {
  const value = step?.metrics?.[key];
  return typeof value === 'number' ? value : 0;
}

function stepReason(step: StepResult): string {
  return step.summaryRows[0]?.details || step.details || 'Step did not run.';
}

function createBlockedStep(step: 'plan' | 'apply', reason: string): StepResult {
  return {
    name: step,
    status: 'skip',
    summaryRows: [
      {
        check: step === 'plan' ? '🏗️ Tofu Plan' : '🚀 Tofu Apply',
        status: '⚠️ Skipped',
        details: reason,
      },
    ],
  };
}

export function runMain(config: ParsedConfig, stepResults: StepResult[]): RuntimeArtifacts {
  const checkSteps = stepResults.filter((step) =>
    ['validate', 'lint', 'trivy', 'checkov', 'test'].includes(step.name),
  );
  const planStep = stepResults.find((step) => step.name === 'plan');
  const applyStep = stepResults.find((step) => step.name === 'apply');

  const summaries: RuntimeArtifacts['summaries'] = {};
  const comments: RuntimeArtifacts['comments'] = {};

  if (checkSteps.length > 0 && config.summaryMode !== 'off') {
    summaries.checksBody = renderChecksSummary(config, checkSteps);
  }

  if (checkSteps.length > 0 && config.commentMode === 'sticky') {
    comments.checksBody = renderChecksComment(config, checkSteps);
  }

  if (planStep) {
    if (config.summaryMode !== 'off') {
      summaries.planBody = renderPlanSummary(
        planStep.status === 'pass'
          ? {
              status: 'pass',
              counts: {
                create: metricNumber(planStep, 'create'),
                update: metricNumber(planStep, 'update'),
                destroy: metricNumber(planStep, 'destroy'),
              },
              details: planStep.details,
            }
          : {
              status: planStep.status,
              reason: stepReason(planStep),
            },
        config.env,
      );
    }

    if (config.commentMode === 'sticky') {
      comments.planBody = renderPlanComment(
        config,
        planStep.status === 'pass'
          ? {
              status: 'pass',
              counts: {
                create: metricNumber(planStep, 'create'),
                update: metricNumber(planStep, 'update'),
                destroy: metricNumber(planStep, 'destroy'),
              },
            }
          : {
              status: planStep.status,
              reason: stepReason(planStep),
            },
      );
    }
  }

  if (applyStep) {
    if (config.summaryMode !== 'off') {
      summaries.applyBody = renderApplySummary(
        config.env,
        applyStep.status === 'pass'
          ? {
              status: 'pass',
              counts: {
                added: metricNumber(applyStep, 'added'),
                changed: metricNumber(applyStep, 'changed'),
                destroyed: metricNumber(applyStep, 'destroyed'),
                imported: metricNumber(applyStep, 'imported'),
                forgotten: metricNumber(applyStep, 'forgotten'),
              },
              details: applyStep.details,
            }
          : {
              status: applyStep.status,
              reason: stepReason(applyStep),
              details: applyStep.details,
            },
      );
    }

    if (config.commentMode === 'sticky') {
      comments.applyBody = renderApplyComment(
        config,
        applyStep.status === 'pass'
          ? {
              status: 'pass',
              counts: {
                added: metricNumber(applyStep, 'added'),
                changed: metricNumber(applyStep, 'changed'),
                destroyed: metricNumber(applyStep, 'destroyed'),
                imported: metricNumber(applyStep, 'imported'),
                forgotten: metricNumber(applyStep, 'forgotten'),
              },
            }
          : {
              status: applyStep.status,
              reason: stepReason(applyStep),
            },
      );
    }
  }

  return {
    comments,
    summaries,
    outputs: mergeStepOutputs(createBaseOutputs(config), stepResults),
    hasFailures: stepResults.some((step) => step.status === 'fail'),
  };
}

export async function executeSelectedSteps(config: ParsedConfig): Promise<StepResult[]> {
  const results: StepResult[] = [];
  let mutatingBlockReason: string | null = null;
  const selected = new Set(config.steps);
  const orderedSteps = EXECUTION_ORDER.filter((step) => selected.has(step));

  // Init covers validate/plan/apply/test and also the scanners. Checkov
  // and Trivy reference external modules declared in the root config
  // (e.g. a downstream `module "x" { source = "org/x/provider" }`);
  // without .terraform/modules/ on disk they fall back to signature
  // introspection, fail to resolve the source, and exit non-zero with a
  // misleading "failed to download module" warning. A backend-less init
  // populates the module cache cheaply and is a no-op when the steps
  // don't need it.
  if (orderedSteps.some((step) => ['validate', 'plan', 'apply', 'test', 'checkov', 'trivy'].includes(step))) {
    await runInit(config);
  }

  for (const step of orderedSteps) {
    core.debug(`step start: ${step}`);
    switch (step) {
      case 'validate':
        results.push(await runValidateStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because a previous check step failed.';
        }
        break;
      case 'plan':
        if (mutatingBlockReason) {
          results.push(createBlockedStep('plan', mutatingBlockReason));
          break;
        }
        results.push(await runPlanStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because the plan step failed.';
        }
        break;
      case 'apply':
        if (mutatingBlockReason) {
          results.push(createBlockedStep('apply', mutatingBlockReason));
          break;
        }
        results.push(await runApplyStep(config));
        break;
      case 'lint':
        results.push(await runLintStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because a previous check step failed.';
        }
        break;
      case 'trivy':
        results.push(await runTrivyStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because a previous check step failed.';
        }
        break;
      case 'checkov':
        results.push(await runCheckovStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because a previous check step failed.';
        }
        break;
      case 'test':
        results.push(await runTestStep(config));
        if (results.at(-1)?.status === 'fail') {
          mutatingBlockReason = 'Blocked because a previous check step failed.';
        }
        break;
    }
    core.debug(`step end: ${step} status=${results.at(-1)?.status ?? 'unknown'}`);
  }

  return results;
}

export async function main(): Promise<void> {
  const config = parseInputs(getActionInputMap());
  registerConfigSecrets(config);
  assertWorkdirExists(config);
  const stepResults = await executeSelectedSteps(config);
  const artifacts = runMain(config, stepResults);

  for (const [key, value] of Object.entries(artifacts.outputs)) {
    core.setOutput(key, value);
  }

  if (artifacts.summaries.checksBody) {
    appendStepSummary(artifacts.summaries.checksBody);
  }
  if (artifacts.summaries.planBody) {
    appendStepSummary(artifacts.summaries.planBody);
  }
  if (artifacts.summaries.applyBody) {
    appendStepSummary(artifacts.summaries.applyBody);
  }

  await syncStickyComments(config, artifacts.comments);

  if (artifacts.hasFailures) {
    core.setFailed('One or more selected tofu-github-action steps failed.');
  }
}

if (require.main === module) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  });
}
