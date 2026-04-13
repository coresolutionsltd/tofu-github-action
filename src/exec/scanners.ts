import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function resolveScannerConfig(
  workdir: string,
  workspace: string,
  actionPath: string,
  fileName: string,
): string | null {
  const candidates = [
    join(workdir, fileName),
    join(workspace, fileName),
    join(actionPath, fileName),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
