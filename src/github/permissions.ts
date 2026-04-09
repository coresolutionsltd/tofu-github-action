import { readFileSync } from 'node:fs';

type PullRequestEvent = {
  pull_request?: {
    head?: {
      repo?: {
        full_name?: string;
      };
    };
    base?: {
      repo?: {
        full_name?: string;
      };
    };
  };
};

export function canWritePullRequestComments(): boolean {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return false;
  }

  if (eventName === 'pull_request_target') {
    return true;
  }

  if (eventName !== 'pull_request' || !eventPath) {
    return false;
  }

  try {
    const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as PullRequestEvent;
    const headRepo = payload.pull_request?.head?.repo?.full_name;
    const baseRepo = payload.pull_request?.base?.repo?.full_name;
    return Boolean(headRepo && baseRepo && headRepo === baseRepo);
  } catch {
    return false;
  }
}
