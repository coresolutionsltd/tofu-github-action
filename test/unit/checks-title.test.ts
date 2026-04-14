import { describe, expect, it } from 'vitest';
import { buildChecksTitle } from '../../src/render/checks-title.js';
import type { StepResult } from '../../src/types.js';

function step(name: StepResult['name']): StepResult {
  return { name, status: 'pass', summaryRows: [] };
}

describe('buildChecksTitle', () => {
  it('maps validate/lint to Validate', () => {
    expect(buildChecksTitle([step('validate'), step('lint')], 'prod')).toBe('🧪 Tofu Validate (prod)');
  });

  it('maps test to Test', () => {
    expect(buildChecksTitle([step('test')], 'prod')).toBe('🧪 Tofu Test (prod)');
  });

  it('maps trivy/checkov to Scan', () => {
    expect(buildChecksTitle([step('trivy'), step('checkov')], 'prod')).toBe('🧪 Tofu Scan (prod)');
  });

  it('combines multiple categories in fixed order', () => {
    expect(buildChecksTitle([step('trivy'), step('test'), step('validate')], 'dev')).toBe(
      '🧪 Tofu Validate, Test, Scan (dev)',
    );
  });

  it('omits env when empty', () => {
    expect(buildChecksTitle([step('validate')], '')).toBe('🧪 Tofu Validate');
  });

  it('falls back to Checks when no categorized steps present', () => {
    expect(buildChecksTitle([step('plan')], 'prod')).toBe('🧪 Tofu Checks (prod)');
  });
});
