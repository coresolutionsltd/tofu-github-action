import * as core from '@actions/core';
import { ALL_STEPS } from './constants.js';
import type { InputMap } from './types.js';
import { parseInputs } from './inputs.js';

export function runPreflight(inputs: InputMap) {
  return parseInputs(inputs);
}

function getInputMap(): InputMap {
  return {
    version: core.getInput('version'),
    workdir: core.getInput('workdir'),
    env: core.getInput('env'),
    steps: core.getInput('steps'),
    'tfvar-files': core.getInput('tfvar-files'),
    tfvars: core.getInput('tfvars'),
    'backend-config-var-files': core.getInput('backend-config-var-files'),
    'backend-config-vars': core.getInput('backend-config-vars'),
    'test-dir': core.getInput('test-dir'),
    'test-tfvar-files': core.getInput('test-tfvar-files'),
    'test-tfvars': core.getInput('test-tfvars'),
    'tflint-version': core.getInput('tflint-version'),
    'trivy-version': core.getInput('trivy-version'),
    'checkov-version': core.getInput('checkov-version'),
    'trivy-scan-type': core.getInput('trivy-scan-type'),
    'checkov-skip-checks': core.getInput('checkov-skip-checks'),
    'lock-timeout': core.getInput('lock-timeout'),
    parallelism: core.getInput('parallelism'),
    refresh: core.getInput('refresh'),
    targets: core.getInput('targets'),
    'artifact-retention-days': core.getInput('artifact-retention-days'),
    'skip-plan-upload': core.getInput('skip-plan-upload'),
    'summary-mode': core.getInput('summary-mode'),
    'comment-mode': core.getInput('comment-mode'),
    'comment-identifier': core.getInput('comment-identifier'),
  };
}

export function preflightMain(): void {
  const config = runPreflight(getInputMap());
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
