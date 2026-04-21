import type { ParsedConfig, StepResult } from '../types.js';
import { renderTable } from '../util/markdown.js';
import { buildChecksTitle } from './checks-title.js';
import { renderCheckFailureBlocks } from './checks-failures.js';

export function renderChecksSummary(config: ParsedConfig, steps: StepResult[]): string {
  const title = `## ${buildChecksTitle(steps, config.env)}`;
  const table = renderTable(steps.flatMap((step) => step.summaryRows));
  const failureBlocks = renderCheckFailureBlocks(steps);
  const trailing = failureBlocks ? `\n${failureBlocks}\n` : '';
  return `${title}\n\n${table}\n${trailing}`;
}
