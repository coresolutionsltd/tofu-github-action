import { getOctokit } from '@actions/github';

export function githubClient() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return null;
  }

  return getOctokit(token);
}
