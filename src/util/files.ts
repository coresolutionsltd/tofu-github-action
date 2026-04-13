export function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}
