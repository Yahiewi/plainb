import type { Notebook } from "./notebook";
import { stringifyYAML } from "./utils";

// ---------------------------------------------------------------------------
// Notebook → Python percent format serializer
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

function buildDelimiter(cellType: string, meta: Record<string, unknown>): string {
  const parts: string[] = ["# %%"];
  if (cellType === "markdown") parts.push("[markdown]");
  else if (cellType === "raw") parts.push("[raw]");
  if (typeof meta.name === "string" && meta.name) parts.push(meta.name);
  if (Array.isArray(meta.tags) && meta.tags.length > 0) {
    parts.push(`tags='${JSON.stringify(meta.tags)}'`);
  }
  return parts.join(" ");
}

/**
 * Serialize a `Notebook` to the Python percent format (VS Code / Spyder / Jupytext).
 *
 * - Code cells → `# %%` delimiter + bare source
 * - Markdown cells → `# %% [markdown]` delimiter + `# `-prefixed lines
 * - Raw cells → `# %% [raw]` delimiter + `# `-prefixed lines
 * - Cell name and tags from metadata are encoded in the delimiter line
 */
export function toPy(notebook: Notebook): string {
  const parts: string[] = [];

  if (Object.keys(notebook.metadata).length > 0) {
    const yamlStr = stringifyYAML({ jupyter: notebook.metadata });
    const commentedYaml = yamlStr
      .split("\n")
      .map((line) => (line === "" ? "#" : `# ${line}`))
      .join("\n");
    parts.push(`# ---\n${commentedYaml}\n# ---`);
  }

  for (const cell of notebook.cells) {
    const delimiter = buildDelimiter(cell.cell_type, cell.metadata);
    const src = joinSource(cell.source);

    if (cell.cell_type === "code") {
      parts.push(src ? `${delimiter}\n${src}` : delimiter);
    } else {
      parts.push(src ? `${delimiter}\n${commentLines(src)}` : delimiter);
    }
  }

  return parts.join("\n\n") + "\n";
}
