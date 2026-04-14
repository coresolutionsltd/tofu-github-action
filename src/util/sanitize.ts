const MAX_ENV_SLUG_LENGTH = 50;

export function sanitizeEnvSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ENV_SLUG_LENGTH)
    .replace(/-+$/g, '');
}
