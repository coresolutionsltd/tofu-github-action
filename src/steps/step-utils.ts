import type { StepResult, SummaryRow } from '../types.js';

export function createStepResult(
  name: StepResult['name'],
  status: StepResult['status'],
  summaryRows: SummaryRow[],
  extras: Omit<StepResult, 'name' | 'status' | 'summaryRows'> = {},
): StepResult {
  return {
    name,
    status,
    summaryRows,
    ...extras,
  };
}
