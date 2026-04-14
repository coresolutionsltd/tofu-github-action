import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedConfig } from '../types.js';

export function resolveWorkdir(config: ParsedConfig): string {
  return join(process.env.GITHUB_WORKSPACE || process.cwd(), config.workdir);
}

export function assertWorkdirExists(config: ParsedConfig): void {
  const workdir = resolveWorkdir(config);
  let stats;
  try {
    stats = statSync(workdir);
  } catch {
    throw new Error(`workdir does not exist: ${workdir}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`workdir is not a directory: ${workdir}`);
  }
}

export function planArtifactBaseName(config: ParsedConfig): string {
  return config.envSlug ? `${config.envSlug}-plan` : 'plan';
}
