import { describe, expect, it } from 'vitest';
import { sanitizeEnvSlug } from '../../src/util/sanitize.js';

describe('sanitizeEnvSlug', () => {
  it('lowercases and replaces unsupported characters', () => {
    expect(sanitizeEnvSlug('Prod/Cluster A')).toBe('prod-cluster-a');
  });

  it('trims leading and trailing separators', () => {
    expect(sanitizeEnvSlug('--prod--')).toBe('prod');
  });

  it('caps length at 50 characters and strips trailing dash', () => {
    const slug = sanitizeEnvSlug('a'.repeat(60));
    expect(slug.length).toBe(50);
  });

  it('does not leave a trailing dash after truncation', () => {
    const slug = sanitizeEnvSlug(`${'a'.repeat(49)}-suffix`);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeEnvSlug('   ')).toBe('');
  });
});
