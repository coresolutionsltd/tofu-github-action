import { readFileSync } from 'node:fs';
import type { CommentArtifacts, ParsedConfig } from '../types.js';
import { githubClient } from './client.js';
import { canWritePullRequestComments } from './permissions.js';
import { buildMarker } from './markers.js';

type IssueComment = {
  id: number;
  body?: string | null;
  updated_at?: string;
  created_at?: string;
};

function issueNumber(): number | null {
  const raw = process.env.GITHUB_EVENT_NAME === 'pull_request' ? process.env.GITHUB_REF : null;
  void raw;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(eventPath, 'utf8')) as { number?: number; pull_request?: { number?: number } };
    return payload.pull_request?.number ?? payload.number ?? null;
  } catch {
    return null;
  }
}

function repoParts(): { owner: string; repo: string } | null {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes('/')) {
    return null;
  }

  const [owner, repo] = repository.split('/', 2);
  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

async function upsertComment(
  marker: string,
  body: string,
  comments: IssueComment[],
  owner: string,
  repo: string,
  issue_number: number,
): Promise<void> {
  const octokit = githubClient();
  if (!octokit) {
    return;
  }

  const existing = comments
    .filter((comment) => comment.body?.includes(marker))
    .sort((a, b) => {
      const left = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const right = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return left - right;
    })
    .at(-1);

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body,
  });
}

export async function syncStickyComments(config: ParsedConfig, artifacts: CommentArtifacts): Promise<void> {
  if (config.commentMode !== 'sticky' || !canWritePullRequestComments()) {
    return;
  }

  const octokit = githubClient();
  const repo = repoParts();
  const issue_number = issueNumber();
  if (!octokit || !repo || issue_number === null) {
    return;
  }

  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    per_page: 100,
  });

  if (artifacts.checksBody) {
    await upsertComment(
      buildMarker(config.commentIdentifier, 'checks', config.envSlug),
      artifacts.checksBody,
      comments,
      repo.owner,
      repo.repo,
      issue_number,
    );
  }

  if (artifacts.planBody) {
    await upsertComment(
      buildMarker(config.commentIdentifier, 'plan', config.envSlug),
      artifacts.planBody,
      comments,
      repo.owner,
      repo.repo,
      issue_number,
    );
  }

  if (artifacts.applyBody) {
    await upsertComment(
      buildMarker(config.commentIdentifier, 'apply', config.envSlug),
      artifacts.applyBody,
      comments,
      repo.owner,
      repo.repo,
      issue_number,
    );
  }
}
