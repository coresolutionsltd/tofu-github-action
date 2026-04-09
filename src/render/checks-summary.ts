import type { ParsedConfig, StepResult } from '../types.js';
import { renderTable } from '../util/markdown.js';

export function renderChecksSummary(config: ParsedConfig, steps: StepResult[]): string {
  const title = `## 🧪 Tofu Checks${config.env ? ` (${config.env})` : ''}`;
  return `${title}\n\n${renderTable(steps.flatMap((step) => step.summaryRows))}\n`;
}
