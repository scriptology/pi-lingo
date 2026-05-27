export function isValidBCP47(tag: string): boolean {
  try {
    const locale = new Intl.Locale(tag);
    return !!locale.language && locale.language.length >= 2;
  } catch {
    return false;
  }
}

export function normalizeBCP47(tag: string): string {
  try {
    return new Intl.Locale(tag).toString();
  } catch {
    return tag.trim().toLowerCase();
  }
}
