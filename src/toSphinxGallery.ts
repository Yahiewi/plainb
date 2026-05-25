import type { Notebook } from "./notebook";

// ---------------------------------------------------------------------------
// Notebook → Sphinx Gallery format serializer
// ---------------------------------------------------------------------------

function joinSource(source: string[]): string {
  return source.join("");
}

/** Prefix each line with `# ` (empty lines become bare `#`). */
function commentLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? "#" : `# ${line}`))
    .join("\n");
}

/**
 * Serialize a `Notebook` to Sphinx Gallery Python script format.
 *
 * - First markdown cell → module-level triple-quoted docstring
 * - Remaining markdown cells → `# %%` section with `# `-prefixed comment block
 * - Code cells → `# %%` section with bare source
 * - Adjacent [markdown, code] pairs are merged into a single `# %%` section
 *   (comment block above the code), matching how `parseSphinxGallery` splits them
 * - Raw cells are omitted
 */
export function toSphinxGallery(notebook: Notebook): string {
  const parts: string[] = [];

  if (Object.keys(notebook.metadata).length > 0) {
    const lines = Object.entries(notebook.metadata).map(([k, v]) => {
      const valStr = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
      return `# ${k}: ${valStr}`;
    });
    parts.push(`# ---\n${lines.join("\n")}\n# ---`);
  }

  const cells = notebook.cells.filter((c) => c.cell_type !== "raw");
  let i = 0;

  // First markdown cell → docstring
  if (cells[0]?.cell_type === "markdown") {
    const src = joinSource(cells[0].source);
    const prefix = src.includes("\\") ? "r" : "";
    parts.push(`${prefix}"""\n${src}\n"""`);
    i = 1;
  }

  while (i < cells.length) {
    const cell = cells[i];

    if (cell.cell_type === "markdown") {
      const mdSrc = joinSource(cell.source);
      const next = cells[i + 1];

      if (next?.cell_type === "code") {
        // Merge adjacent [markdown, code] into one section
        const codeSrc = joinSource(next.source);
        const section = `# %%\n${commentLines(mdSrc)}`;
        parts.push(codeSrc ? `${section}\n\n${codeSrc}` : section);
        i += 2;
      } else {
        parts.push(`# %%\n${commentLines(mdSrc)}`);
        i++;
      }
    } else {
      // code cell
      const src = joinSource(cell.source);
      parts.push(`# %%\n${src}`);
      i++;
    }
  }

  return parts.join("\n\n") + "\n";
}
