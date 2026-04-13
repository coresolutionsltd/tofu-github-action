import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { loadCheckovJson, resolveCheckovJsonPath } from '../../src/steps/checkov.js';

describe('checkov output handling', () => {
  it('resolves Checkov JSON from an output directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'checkov-output-'));
    const outputDir = join(root, 'checkov_output');
    mkdirSync(outputDir);
    const resultPath = join(outputDir, 'results_json.json');
    writeFileSync(resultPath, '{"summary":{"failed":0}}');

    expect(resolveCheckovJsonPath(outputDir)).toBe(resultPath);
    expect(loadCheckovJson(outputDir)).toEqual({ summary: { failed: 0 } });
  });
});
