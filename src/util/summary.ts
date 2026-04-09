import { appendFileSync } from 'node:fs';

export function appendStepSummary(body: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  appendFileSync(summaryPath, `${body.trimEnd()}\n`);
}
