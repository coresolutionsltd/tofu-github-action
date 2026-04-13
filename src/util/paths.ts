import { join } from 'node:path';
import type { ParsedConfig } from '../types.js';

export function resolveWorkdir(config: ParsedConfig): string {
  return join(process.env.GITHUB_WORKSPACE || process.cwd(), config.workdir);
}

export function planArtifactBaseName(config: ParsedConfig): string {
  return config.envSlug ? `${config.envSlug}-plan` : 'plan';
}
