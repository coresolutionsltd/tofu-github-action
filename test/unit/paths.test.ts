import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertWorkdirExists, resolveWorkdir } from '../../src/util/paths.js';
import type { ParsedConfig } from '../../src/types.js';

const baseConfig: ParsedConfig = {
  version: '1.12.5',
  workdir: '.',
  env: '',
  envSlug: '',
  steps: ['validate'],
  tfvarFiles: [],
  tfvars: [],
  backendConfigVarFiles: [],
  backendConfigVars: [],
  testDir: 'tests',
  testTfvarFiles: [],
  testTfvars: [],
  tflintVersion: '0.55.1',
  trivyVersion: '0.69.3',
  checkovVersion: '3.2.497',
  trivyScanType: 'config',
  checkovSkipChecks: [],
  lockTimeout: '',
  parallelism: '',
  refresh: undefined,
  targets: [],
  artifactRetentionDays: undefined,
  skipPlanUpload: true,
  summaryMode: 'redacted',
  commentMode: 'off',
  commentIdentifier: 'tf',
};

describe('assertWorkdirExists', () => {
  let dir: string;
  const originalWorkspace = process.env.GITHUB_WORKSPACE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tofu-ga-test-'));
    process.env.GITHUB_WORKSPACE = dir;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalWorkspace === undefined) {
      delete process.env.GITHUB_WORKSPACE;
    } else {
      process.env.GITHUB_WORKSPACE = originalWorkspace;
    }
  });

  it('passes when workdir resolves to an existing directory', () => {
    expect(() => assertWorkdirExists({ ...baseConfig, workdir: '.' })).not.toThrow();
  });

  it('throws when workdir does not exist', () => {
    expect(() => assertWorkdirExists({ ...baseConfig, workdir: 'missing' })).toThrow(/does not exist/);
  });

  it('throws when workdir path is a file', () => {
    const filePath = join(dir, 'file.txt');
    writeFileSync(filePath, 'x');
    expect(() => assertWorkdirExists({ ...baseConfig, workdir: 'file.txt' })).toThrow(/not a directory/);
  });

  it('resolves against GITHUB_WORKSPACE', () => {
    expect(resolveWorkdir({ ...baseConfig, workdir: 'sub' })).toBe(join(dir, 'sub'));
  });
});
