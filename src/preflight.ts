import * as core from '@actions/core';
import { ALL_STEPS } from './constants.js';
import { getActionInputMap } from './action-inputs.js';
import type { InputMap } from './types.js';
import { parseInputs } from './inputs.js';

export function runPreflight(inputs: InputMap) {
  return parseInputs(inputs);
}

export function preflightMain(): void {
  const config = runPreflight(getActionInputMap());
  core.setOutput('env_slug', config.envSlug);
  core.setOutput('selected_steps', config.steps.join(','));
  core.setOutput('plan_artifact_name', config.envSlug ? `${config.envSlug}-plan.tfplan.gz` : 'plan.tfplan.gz');
  for (const step of ALL_STEPS) {
    core.setOutput(`run_${step}`, config.steps.includes(step) ? 'true' : 'false');
  }
}

if (require.main === module) {
  try {
    preflightMain();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}
