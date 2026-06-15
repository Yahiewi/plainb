// nbformat 4 types and factory helpers

export interface CodeCell {
  cell_type: "code";
  id: string;
  metadata: Record<string, unknown>;
  source: string[];
  outputs: [];
  execution_count: null;
}

export interface MarkdownCell {
  cell_type: "markdown";
  id: string;
  metadata: Record<string, unknown>;
  source: string[];
}

export interface RawCell {
  cell_type: "raw";
  id: string;
  metadata: Record<string, unknown>;
  source: string[];
}

export type Cell = CodeCell | MarkdownCell | RawCell;

export interface Notebook {
  nbformat: 4;
  nbformat_minor: 5;
  metadata: Record<string, unknown>;
  cells: Cell[];
}

// ---------------------------------------------------------------------------
// ID generation — no crypto, browser-safe
// ---------------------------------------------------------------------------

function makeId(used: Set<string>): string {
  let id: string;
  do {
    id = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  } while (used.has(id));
  used.add(id);
  return id;
}

// ---------------------------------------------------------------------------
// Source normalization
// ---------------------------------------------------------------------------

/** Convert a raw string into nbformat source array (lines with \n except last). */
export function toSource(text: string): string[] {
  if (!text) return [];
  // Strip single trailing newline that separates cells (not part of content)
  const stripped = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (!stripped) return [];
  const lines = stripped.split("\n");
  return lines.map((line, i) => (i < lines.length - 1 ? line + "\n" : line));
}

// ---------------------------------------------------------------------------
// Cell factories
// ---------------------------------------------------------------------------

export function codeCell(
  source: string,
  metadata: Record<string, unknown> = {},
  used: Set<string> = new Set(),
): CodeCell {
  return {
    cell_type: "code",
    id: makeId(used),
    metadata,
    source: toSource(source),
    outputs: [],
    execution_count: null,
  };
}

export function markdownCell(
  source: string,
  metadata: Record<string, unknown> = {},
  used: Set<string> = new Set(),
): MarkdownCell {
  return {
    cell_type: "markdown",
    id: makeId(used),
    metadata,
    source: toSource(source),
  };
}

export function rawCell(
  source: string,
  metadata: Record<string, unknown> = {},
  used: Set<string> = new Set(),
): RawCell {
  return {
    cell_type: "raw",
    id: makeId(used),
    metadata,
    source: toSource(source),
  };
}

// ---------------------------------------------------------------------------
// Notebook factory
// ---------------------------------------------------------------------------

export function makeNotebook(cells: Cell[], metadata: Record<string, unknown> = {}): Notebook {
  return { nbformat: 4, nbformat_minor: 5, metadata, cells };
}

export interface SerializationOptions {
  notebookMetadataFilter?: string;
  cellMetadataFilter?: string;
}
