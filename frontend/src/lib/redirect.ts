export function isSafeInternalRedirect(value: string): boolean {
  if (!value.startsWith("/")) {
    return false;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return false;
  }
  return true;
}
