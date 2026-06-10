import type { Notebook } from "./notebook";
import { stringifyYAML, pythonStyleJSON, cleanCellMetadata } from "./utils";

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

function isSimpleMetadata(meta: Record<string, unknown>): boolean {
  for (const val of Object.values(meta)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return false;
    }
  }
  return true;
}

function buildDelimiter(cellType: string, meta: Record<string, unknown>): string {
  const parts: string[] = ["# %%"];
  if (cellType === "markdown") parts.push("[markdown]");
  else if (cellType === "raw") parts.push("[raw]");

  const cleanMeta = { ...meta };
  delete cleanMeta.cell_marker;

  let cellName = "";
  if (typeof cleanMeta.name === "string" && cleanMeta.name) {
    cellName = cleanMeta.name;
    delete cleanMeta.name;
  } else if (typeof cleanMeta.title === "string" && cleanMeta.title) {
    cellName = cleanMeta.title;
    delete cleanMeta.title;
  }

  if (cellName) {
    parts.push(cellName);
  }

  if (Object.keys(cleanMeta).length > 0) {
    if (isSimpleMetadata(cleanMeta)) {
      const optStr = Object.entries(cleanMeta)
        .map(([key, val]) => {
          if (typeof val === "string") {
            return `${key}=${JSON.stringify(val)}`;
          }
          if (Array.isArray(val)) {
            const items = val.map((item) => JSON.stringify(item)).join(", ");
            return `${key}=[${items}]`;
          }
          return `${key}=${JSON.stringify(val)}`;
        })
        .join(" ");
      parts.push(optStr);
    } else {
      parts.push(pythonStyleJSON(cleanMeta));
    }
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
    const cleanMeta = cleanCellMetadata(cell.metadata);
    const delimiter = buildDelimiter(cell.cell_type, cleanMeta);
    const src = joinSource(cell.source);

    if (cell.cell_type === "code") {
      parts.push(src ? `${delimiter}\n${src}` : delimiter);
    } else {
      parts.push(src ? `${delimiter}\n${commentLines(src)}` : delimiter);
    }
  }

  return parts.join("\n\n") + "\n";
}
