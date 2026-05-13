import type { Notebook } from "./notebook";

// ---------------------------------------------------------------------------
// Notebook → MyST Markdown serializer
// ---------------------------------------------------------------------------

function joinSource(source: string[]): string {
  return source.join("");
}

function serializeOptions(meta: Record<string, unknown>): string[] {
  return Object.entries(meta).map(([key, val]) =>
    typeof val === "string" ? `:${key}: ${val}` : `:${key}: ${JSON.stringify(val)}`,
  );
}

/**
 * Serialize a `Notebook` to MyST Notebook Markdown.
 *
 * - Notebook metadata → YAML front matter (`---...---`)
 * - Markdown cells → plain text separated by `+++` (with JSON metadata inline)
 * - Code cells → ` ```{code-cell} ` directive with shorthand options
 * - Raw cells  → ` ```{raw-cell} ` directive with shorthand options
 */
export function toMystMd(notebook: Notebook): string {
  const parts: string[] = [];

  if (Object.keys(notebook.metadata).length > 0) {
    const lines = Object.entries(notebook.metadata).map(([k, v]) => {
      const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      return `${k}: ${valStr}`;
    });
    parts.push(`---\n${lines.join("\n")}\n---`);
  }

  for (const cell of notebook.cells) {
    if (cell.cell_type === "markdown") {
      const hasMeta = Object.keys(cell.metadata).length > 0;
      if (parts.length > 0 || hasMeta) {
        const metaStr = hasMeta ? ` ${JSON.stringify(cell.metadata)}` : "";
        parts.push(`+++${metaStr}`);
      }
      const src = joinSource(cell.source);
      if (src) parts.push(src);
    } else {
      const directive = cell.cell_type === "code" ? "code-cell" : "raw-cell";
      const lines: string[] = [`\`\`\`{${directive}}`];
      const optionLines = serializeOptions(cell.metadata);
      lines.push(...optionLines);
      if (optionLines.length > 0) lines.push("");
      const src = joinSource(cell.source);
      if (src) lines.push(src);
      lines.push("```");
      parts.push(lines.join("\n"));
    }
  }

  return parts.join("\n\n") + "\n";
}
