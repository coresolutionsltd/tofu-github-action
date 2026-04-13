import type { ParsedConfig, StepResult } from './types.js';

export type ActionOutputs = Record<string, string>;

export function createBaseOutputs(config: ParsedConfig): ActionOutputs {
  return {
    env: config.env,
    env_slug: config.envSlug,
    selected_steps: config.steps.join(','),
  };
}

export function mergeStepOutputs(outputs: ActionOutputs, steps: StepResult[]): ActionOutputs {
  const merged = { ...outputs };
  for (const step of steps) {
    merged[`${step.name}_status`] = step.status;
    if (step.outputs) {
      Object.assign(merged, step.outputs);
    }
  }
  merged.has_failures = steps.some((step) => step.status === 'fail') ? 'true' : 'false';
  return merged;
}
