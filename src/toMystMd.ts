import type { Notebook, SerializationOptions } from "./notebook";
import { stringifyYAML, pythonStyleJSON, cleanCellMetadata, filterMetadata } from "./utils";

// ---------------------------------------------------------------------------
// Notebook → MyST Markdown serializer
// ---------------------------------------------------------------------------

function joinSource(source: string[]): string {
  return source.join("");
}

/** Check if metadata has nested objects (not simple). */
function isSimpleMetadata(meta: Record<string, unknown>): boolean {
  for (const val of Object.values(meta)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return false;
    }
  }
  return true;
}

/** Serialize flat keys to MyST compact colon shorthand. */
function serializeCompactOptions(meta: Record<string, unknown>): string[] {
  return Object.entries(meta).map(([key, val]) => {
    if (Array.isArray(val)) {
      const items = val
        .map((item) => {
          if (typeof item === "string" && /^[a-zA-Z0-9_-]+$/.test(item)) {
            return item;
          }
          return JSON.stringify(item);
        })
        .join(", ");
      return `:${key}: [${items}]`;
    }
    if (typeof val === "string") {
      return `:${key}: ${val}`;
    }
    return `:${key}: ${JSON.stringify(val)}`;
  });
}

/**
 * Serialize a `Notebook` to MyST Notebook Markdown.
 *
 * - Notebook metadata → YAML front matter (`---...---`)
 * - Markdown cells → plain text separated by `+++` (with JSON metadata inline)
 * - Code cells → ` ```{code-cell} ` directive with shorthand options
 * - Raw cells  → ` ```{raw-cell} ` directive with shorthand options
 */
export function toMystMd(notebook: Notebook, options?: SerializationOptions): string {
  const parts: string[] = [];

  const notebookMeta = typeof options?.notebookMetadataFilter === "string"
    ? filterMetadata(notebook.metadata, options.notebookMetadataFilter)
    : notebook.metadata;

  if (Object.keys(notebookMeta).length > 0) {
    const yamlStr = stringifyYAML(notebookMeta);
    parts.push(`---\n${yamlStr}\n---`);
  }

  for (const cell of notebook.cells) {
    const cleanMeta = options?.cellMetadataFilter !== undefined
      ? filterMetadata(cell.metadata, options.cellMetadataFilter)
      : cleanCellMetadata(cell.metadata);

    if (cell.cell_type === "markdown") {
      const hasMeta = Object.keys(cleanMeta).length > 0;
      if (parts.length > 0 || hasMeta) {
        const metaStr = hasMeta ? ` ${pythonStyleJSON(cleanMeta)}` : "";
        parts.push(`+++${metaStr}`);
      }
      const src = joinSource(cell.source);
      if (src) parts.push(src);
    } else {
      const directive = cell.cell_type === "code" ? "code-cell" : "raw-cell";
      const lines: string[] = [`\`\`\`{${directive}}`];

      const hasMeta = Object.keys(cleanMeta).length > 0;
      if (hasMeta) {
        if (isSimpleMetadata(cleanMeta)) {
          const optionLines = serializeCompactOptions(cleanMeta);
          lines.push(...optionLines);
          lines.push("");
        } else {
          const yamlStr = stringifyYAML(cleanMeta);
          lines.push("---");
          lines.push(yamlStr);
          lines.push("---");
        }
      }

      const src = joinSource(cell.source);
      if (src) lines.push(src);
      lines.push("```");
      parts.push(lines.join("\n"));
    }
  }

  return parts.join("\n\n") + "\n";
}
