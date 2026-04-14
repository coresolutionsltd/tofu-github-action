import type { ParsedConfig, StepResult } from '../types.js';
import { renderTable } from '../util/markdown.js';
import { buildChecksTitle } from './checks-title.js';

export function renderChecksSummary(config: ParsedConfig, steps: StepResult[]): string {
  const title = `## ${buildChecksTitle(steps, config.env)}`;
  return `${title}\n\n${renderTable(steps.flatMap((step) => step.summaryRows))}\n`;
}
