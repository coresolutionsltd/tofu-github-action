import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { canWritePullRequestComments } from '../../src/github/permissions.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('canWritePullRequestComments', () => {
  it('returns false when there is no token', () => {
    delete process.env.GITHUB_TOKEN;
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    expect(canWritePullRequestComments()).toBe(false);
  });

  it('returns false for fork pull requests', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tofu-gha-'));
    const eventPath = join(dir, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          head: { repo: { full_name: 'fork/repo' } },
          base: { repo: { full_name: 'origin/repo' } },
        },
      }),
    );

    process.env.GITHUB_TOKEN = 'token';
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.GITHUB_EVENT_PATH = eventPath;

    expect(canWritePullRequestComments()).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns true for same-repo pull requests', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tofu-gha-'));
    const eventPath = join(dir, 'event.json');
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          head: { repo: { full_name: 'origin/repo' } },
          base: { repo: { full_name: 'origin/repo' } },
        },
      }),
    );

    process.env.GITHUB_TOKEN = 'token';
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.GITHUB_EVENT_PATH = eventPath;

    expect(canWritePullRequestComments()).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
