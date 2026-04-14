import type { ParsedConfig, StepResult } from '../types.js';
import { buildMarker } from '../github/markers.js';
import { renderTable } from '../util/markdown.js';
import { buildChecksTitle } from './checks-title.js';

export function renderChecksComment(config: ParsedConfig, steps: StepResult[]): string {
  const marker = buildMarker(config.commentIdentifier, 'checks', config.envSlug);
  const header = `### ${buildChecksTitle(steps, config.env)}`;
  const rows = steps.flatMap((step) => step.summaryRows);

  return `${marker}
${header}
${renderTable(rows)}`;
}
