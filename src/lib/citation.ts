export function exactCharacterLocator(sourceText: string, exactQuote: string) {
  const start = sourceText.indexOf(exactQuote);
  if (start < 0) throw new Error("The exact quote must occur verbatim in the source text.");
  return { start, end: start + exactQuote.length };
}

export function sha256Manifest(sha256s: string[]) {
  return [...sha256s].sort().join("\n");
}
