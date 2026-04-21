import type { StepResult } from '../types.js';
import { redactText } from '../util/redact.js';

// Keep per-step output bounded so a single catastrophic failure does not blow
// past GitHub's 65 KiB step-summary / PR-comment limits and stop later content
// from rendering. Everything above the threshold is dropped with a notice.
const MAX_FAILURE_BODY_LENGTH = 60_000;

function renderFailureBlock(step: StepResult): string {
  const label = step.summaryRows[0]?.check ?? step.name;
  const body = redactText((step.details ?? '').trim());
  const truncated =
    body.length > MAX_FAILURE_BODY_LENGTH
      ? `${body.slice(0, MAX_FAILURE_BODY_LENGTH)}\n… output truncated (${body.length - MAX_FAILURE_BODY_LENGTH} more chars)`
      : body;
  return `<details><summary>${label} — failure output</summary>\n\n\`\`\`\n${truncated}\n\`\`\`\n\n</details>`;
}

export function renderCheckFailureBlocks(steps: StepResult[]): string {
  return steps
    .filter((step) => step.status === 'fail' && (step.details ?? '').trim().length > 0)
    .map(renderFailureBlock)
    .join('\n\n');
}
