import { parseClassicMd } from "./parseClassicMd";
import { parseMystMd } from "./parseMystMd";
import type { Notebook } from "./notebook";

/** Detect MyST notebook format by scanning for {code-cell}/{raw-cell} directives or +++ breaks. */
export function isMyST(text: string): boolean {
  const lines = text.split("\n");
  const limit = Math.min(lines.length, 100);
  for (let i = 0; i < limit; i++) {
    const line = lines[i];
    if (/^```\{(?:code-cell|raw-cell|markdown-cell)\}/.test(line)) return true;
    if (/^\+\+\+/.test(line)) return true;
  }
  return false;
}

export function parseMd(text: string): Notebook {
  return isMyST(text) ? parseMystMd(text) : parseClassicMd(text);
}
