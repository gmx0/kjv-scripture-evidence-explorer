import type { Token } from "../../shared/src/index.ts";

export const TOKENIZER_VERSION = "1.0.0";
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    const surface = match[0];
    const charStart = match.index;
    tokens.push({
      position: tokens.length,
      charStart,
      charEnd: charStart + surface.length,
      surface,
      folded: foldToken(surface),
    });
  }
  return tokens;
}

export function foldToken(surface: string): string {
  return surface.normalize("NFC").toLowerCase();
}

export function normalizeToken(token: Token): { normalized: string; rules: string[] } {
  const rules: string[] = [];
  let normalized = token.folded;
  if (normalized.includes("’")) {
    normalized = normalized.replaceAll("’", "'");
    rules.push("typographic-apostrophe-equivalence");
  }
  return { normalized, rules };
}
