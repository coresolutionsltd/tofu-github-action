import type { TofuStep } from '../constants.js';
import type { StepResult } from '../types.js';

const CATEGORY_ORDER = ['Validate', 'Test', 'Scan'] as const;
type Category = (typeof CATEGORY_ORDER)[number];

const STEP_TO_CATEGORY: Record<TofuStep, Category | null> = {
  validate: 'Validate',
  lint: 'Validate',
  test: 'Test',
  trivy: 'Scan',
  checkov: 'Scan',
  plan: null,
  apply: null,
};

export function buildChecksTitle(steps: StepResult[], env: string): string {
  const categories = new Set<Category>();
  for (const step of steps) {
    const category = STEP_TO_CATEGORY[step.name];
    if (category) categories.add(category);
  }

  const ordered = CATEGORY_ORDER.filter((c) => categories.has(c));
  const label = ordered.length > 0 ? `Tofu ${ordered.join(', ')}` : 'Tofu Checks';
  return `🧪 ${label}${env ? ` (${env})` : ''}`;
}
