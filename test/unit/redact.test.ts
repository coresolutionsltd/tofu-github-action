import { beforeEach, describe, expect, it } from 'vitest';
import { redactText, registerSecret, resetSecretsForTesting } from '../../src/util/redact.js';

describe('redactText', () => {
  beforeEach(() => {
    resetSecretsForTesting();
  });

  it('masks registered secrets in text', () => {
    registerSecret('super-secret-value');
    expect(redactText('token=super-secret-value end')).toBe('token=*** end');
  });

  it('ignores values shorter than the minimum length', () => {
    registerSecret('abc');
    expect(redactText('abc')).toBe('abc');
  });

  it('masks multiple occurrences', () => {
    registerSecret('repeated-secret');
    expect(redactText('a=repeated-secret b=repeated-secret')).toBe('a=*** b=***');
  });

  it('is a no-op when no secrets match', () => {
    registerSecret('unused-secret');
    expect(redactText('nothing sensitive here')).toBe('nothing sensitive here');
  });

  it('handles empty input', () => {
    expect(redactText('')).toBe('');
  });
});
