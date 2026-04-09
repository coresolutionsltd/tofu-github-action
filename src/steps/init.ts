import type { ParsedConfig } from '../types.js';
import { buildBackendConfigArgs, runTofu } from '../exec/tofu.js';
import { resolveWorkdir } from '../util/paths.js';

export async function runInit(config: ParsedConfig): Promise<void> {
  const cwd = resolveWorkdir(config);
  const needsBackend = config.steps.includes('plan') || config.steps.includes('apply');
  const args = ['init'];

  if (!needsBackend) {
    args.push('-backend=false');
  } else {
    args.push(...buildBackendConfigArgs(config));
  }

  await runTofu(args, { cwd });
}
