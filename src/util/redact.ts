import * as core from '@actions/core';

const MIN_SECRET_LENGTH = 4;
const registered = new Set<string>();

export function registerSecret(value: string | undefined | null): void {
  if (!value || value.length < MIN_SECRET_LENGTH) return;
  if (registered.has(value)) return;
  registered.add(value);
  core.setSecret(value);
}

// Strip ANSI CSI escape sequences (\x1b[...m) before rendering to
// markdown. GitHub's step summary / PR comment renderer does not
// interpret ANSI, so leaving them in produces replacement-character
// noise like `�[31m` in the output.
const ANSI_CSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function redactText(text: string): string {
  if (!text) return text;
  let result = text.replace(ANSI_CSI_PATTERN, '');
  for (const secret of registered) {
    if (result.includes(secret)) {
      result = result.split(secret).join('***');
    }
  }
  return result;
}

export function redactedDetails(): string {
  return 'Details redacted';
}

export function resetSecretsForTesting(): void {
  registered.clear();
}
