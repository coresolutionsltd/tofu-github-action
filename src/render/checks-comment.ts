import type { ParsedConfig, StepResult } from '../types.js';
import { buildMarker } from '../github/markers.js';
import { renderTable } from '../util/markdown.js';
import { buildChecksTitle } from './checks-title.js';
import { renderCheckFailureBlocks } from './checks-failures.js';

export function renderChecksComment(config: ParsedConfig, steps: StepResult[]): string {
  const marker = buildMarker(config.commentIdentifier, 'checks', config.envSlug);
  const header = `### ${buildChecksTitle(steps, config.env)}`;
  const rows = steps.flatMap((step) => step.summaryRows);
  const failureBlocks = renderCheckFailureBlocks(steps);
  const trailing = failureBlocks ? `\n\n${failureBlocks}` : '';

  return `${marker}
${header}
${renderTable(rows)}${trailing}`;
}
