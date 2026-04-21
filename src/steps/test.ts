import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { ParsedConfig, StepResult } from '../types.js';
import { execFileSafe } from '../exec/process.js';
import { buildVarArgs, runTofu } from '../exec/tofu.js';
import { resolveWorkdir } from '../util/paths.js';
import { createStepResult } from './step-utils.js';
import { echoFailureOutput } from '../util/echo-failure.js';

function titleizeTestDir(testDir: string): string {
  const leaf = basename(testDir || 'tests');
  return leaf
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Tests';
}

export async function runTestStep(config: ParsedConfig): Promise<StepResult> {
  const cwd = resolveWorkdir(config);
  const testDir = config.testDir.trim();
  const label = titleizeTestDir(testDir);
  const checkName = `🧪 Tofu Test (${label})`;

  if (!testDir) {
    return createStepResult(
      'test',
      'skip',
      [
        {
          check: checkName,
          status: '⚠️ Skipped',
          details: 'No test directory configured; no OpenTofu tests were executed.',
        },
      ],
      {
        outputs: {
          test_ran: 'false',
          test_skipped: 'true',
          test_failed: 'false',
        },
      },
    );
  }

  const absoluteTestDir = `${cwd}/${testDir}`;
  if (!existsSync(absoluteTestDir)) {
    return createStepResult(
      'test',
      'skip',
      [
        {
          check: checkName,
          status: '⚠️ Skipped',
          details: `No OpenTofu tests were executed in \`${testDir}\`.`,
        },
      ],
      {
        outputs: {
          test_ran: 'false',
          test_skipped: 'true',
          test_failed: 'false',
        },
      },
    );
  }

  const testFiles = await execFileSafe('find', [testDir, '-name', '*.tftest.hcl', '-print', '-quit'], {
    cwd,
    allowFailure: true,
  });
  if (!testFiles.stdout.trim()) {
    return createStepResult(
      'test',
      'skip',
      [
        {
          check: checkName,
          status: '⚠️ Skipped',
          details: `No OpenTofu tests were executed in \`${testDir}\`.`,
        },
      ],
      {
        outputs: {
          test_ran: 'false',
          test_skipped: 'true',
          test_failed: 'false',
        },
      },
    );
  }

  const testRun = await runTofu(
    ['test', '-no-color', `-test-directory=${testDir}`, ...buildVarArgs(config, 'test')],
    { cwd, allowFailure: true },
  );
  const status = testRun.exitCode === 0 ? 'pass' : 'fail';
  if (status === 'fail') {
    echoFailureOutput('tofu test', testRun);
  }
  const details =
    status === 'pass'
      ? `All OpenTofu tests passed in \`${testDir}\`.`
      : `OpenTofu tests failed in \`${testDir}\`.`;

  return createStepResult(
    'test',
    status,
    [
      {
        check: checkName,
        status: status === 'pass' ? '✅ Pass' : '❌ Fail',
        details,
      },
    ],
    {
      details: status === 'fail' ? testRun.stdout.trim() || testRun.stderr.trim() : undefined,
      outputs: {
        test_ran: 'true',
        test_skipped: 'false',
        test_failed: status === 'fail' ? 'true' : 'false',
      },
    },
  );
}
