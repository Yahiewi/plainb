import type { Notebook } from "./notebook.js";
import { stringifyYAML } from "./utils.js";

// ---------------------------------------------------------------------------
// Notebook → Classic Markdown serializer
// ---------------------------------------------------------------------------
function joinSource(source: string[]): string {
  return source.join("");
}

/**
 * Serialize a `Notebook` to classic Markdown format.
 *
 * - Markdown cells → raw text
 * - Code cells → fenced code block (`` ```language ```)
 * - Raw cells are omitted (no representation in classic Markdown)
 *
 * Cell metadata is not preserved — the classic format carries no metadata.
 *
 * @param language Fence language tag for code cells. Defaults to `"python"`.
 */
export function toClassicMd(notebook: Notebook, language = "python"): string {
  const parts: string[] = [];

  if (notebook.metadata && Object.keys(notebook.metadata).length > 0) {
    const yamlStr = stringifyYAML({ jupyter: notebook.metadata });
    parts.push(`---\n${yamlStr}\n---`);
  }

  for (const cell of notebook.cells) {
    if (cell.cell_type === "markdown") {
      const src = joinSource(cell.source);
      if (src) parts.push(src);
    } else if (cell.cell_type === "code") {
      const src = joinSource(cell.source);
      parts.push(`\`\`\`${language}\n${src}\n\`\`\``);
    }
    // raw cells: no representation in classic Markdown
  }

  return parts.join("\n\n") + "\n";
}
