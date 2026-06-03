// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

import { isMyST } from "./parseMd";

export type PlainbFormat = "percent" | "sphinx-gallery" | "classic" | "myst";

/**
 * Tracks quote states to determine if lines/delimiters are within strings or docstrings.
 */
class StringParser {
  private single: string | null = null;
  private triple: string | null = null;
  private tripleStart = -1;

  isQuoted(): boolean {
    return this.single !== null || this.triple !== null;
  }

  readLine(line: string): void {
    // Comment lines outside of strings do not change state.
    if (!this.isQuoted() && line.trimStart().startsWith("#")) {
      return;
    }
    this.tripleStart = -1;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      // '#' outside of any string starts a comment.
      if (this.single === null && this.triple === null && char === "#") {
        break;
      }
      if (char !== '"' && char !== "'") {
        continue;
      }
      // Escaped quote.
      if (line[i - 1] === "\\") {
        continue;
      }
      if (this.single === char) {
        this.single = null;
        continue;
      }
      if (this.single !== null) {
        continue;
      }
      // Triple quote start or end.
      if (i >= this.tripleStart + 3 && line.slice(i - 2, i + 1) === char.repeat(3)) {
        if (this.triple === char) {
          this.triple = null;
          this.tripleStart = i;
          continue;
        }
        if (this.triple !== null) {
          continue;
        }
        this.triple = char;
        this.tripleStart = i;
        continue;
      }
      if (this.triple !== null) {
        continue;
      }
      // Single/double quoted string start.
      this.single = char;
    }
    // Single-line quotes do not carry over to the next line in Python.
    this.single = null;
  }
}

const DOUBLE_PERCENT_RE = /^#\s*%%/;
const TWENTY_HASH_RE = /^#( ?)#{19,}\s*$/;

/** Check if the file starts with a module docstring, ignoring front matter. */
function hasLeadingDocstring(lines: string[]): boolean {
  let i = 0;
  // Skip commented YAML front matter.
  if (lines[0]?.trim() === "# ---") {
    i = 1;
    while (i < lines.length && lines[i].trim() !== "# ---") {
      i++;
    }
    i++; // skip the closing delimiter
  }
  // A module docstring may only be preceded by blank lines and comments.
  while (i < lines.length && (lines[i].trim() === "" || lines[i].trimStart().startsWith("#"))) {
    i++;
  }
  return /^[rbuf]*("""|''')/i.test((lines[i] ?? "").trimStart());
}

/** Detect whether a Python script uses percent or Sphinx Gallery format. */
export function detectPy(text: string): "percent" | "sphinx-gallery" {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const parser = new StringParser();
  let doublePercent = 0;
  let twentyHash = 0;
  let hasPercentMd = false;

  for (const line of lines) {
    parser.readLine(line);
    if (parser.isQuoted()) {
      continue;
    }
    if (DOUBLE_PERCENT_RE.test(line)) {
      doublePercent++;
      if (/# %%\s*\[(markdown|md|raw)\]/i.test(line)) {
        hasPercentMd = true;
      }
    }
    if (TWENTY_HASH_RE.test(line)) {
      twentyHash++;
    }
  }

  // A Sphinx Gallery script starts with a module docstring, and separates
  // cells using either twenty hashes or `# %%` without percent-format cell tags.
  if (hasLeadingDocstring(lines) && !hasPercentMd) {
    return "sphinx-gallery";
  }

  if (doublePercent >= 1) {
    return "percent";
  }
  if (twentyHash >= 2) {
    return "sphinx-gallery";
  }
  return "percent";
}

/**
 * Detect the plainb format of a file from its text and extension.
 */
export function detectFormat(text: string, ext: string): PlainbFormat {
  const normExt = ext.toLowerCase().replace(/^\./, "");
  if (normExt === "md" || normExt === "markdown") {
    return isMyST(text) ? "myst" : "classic";
  }
  return detectPy(text);
}
