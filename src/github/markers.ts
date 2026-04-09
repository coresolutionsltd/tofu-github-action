export function buildMarker(identifier: string, kind: 'checks' | 'plan' | 'apply', envSlug: string): string {
  const suffix = envSlug ? `:${envSlug}` : '';
  return `<!-- ${identifier}:${kind}${suffix} -->`;
}
