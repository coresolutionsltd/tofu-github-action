import type { ParsedConfig } from '../types.js';
import { buildBackendConfigArgs, runTofu } from '../exec/tofu.js';
import { resolveWorkdir } from '../util/paths.js';
import { echoFailureOutput } from '../util/echo-failure.js';

export async function runInit(config: ParsedConfig): Promise<void> {
  const cwd = resolveWorkdir(config);
  const needsBackend = config.steps.includes('plan') || config.steps.includes('apply');
  const args = ['init', '-no-color'];

  if (!needsBackend) {
    args.push('-backend=false');
  } else {
    args.push(...buildBackendConfigArgs(config));
  }

  // Capture failure output before rethrowing so backend-init / module
  // download errors show in the runner log instead of being swallowed.
  const result = await runTofu(args, { cwd, allowFailure: true });
  if (result.exitCode !== 0) {
    echoFailureOutput('tofu init', result);
    throw new Error(`tofu init failed with exit code ${result.exitCode}`);
  }
}
