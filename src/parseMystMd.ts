import {
  codeCell,
  markdownCell,
  rawCell,
  makeNotebook,
  type Cell,
  type Notebook,
} from "./notebook";
import { parseYAMLBlock } from "./utils";

// ---------------------------------------------------------------------------
// MyST notebook format parser
// Handles {code-cell}, {raw-cell}, {markdown-cell} directives
// and +++ cell-break syntax
// ---------------------------------------------------------------------------

// ```{code-cell} ipython3   or   ```{raw-cell}
const DIRECTIVE_OPEN_RE = /^(`{3,})\{([\w-]+)\}(?:\s+(\S+))?\s*$/;
// +++ or +++ {"tags": [...]}
const CELL_BREAK_RE = /^\+\+\+(?:\s+(\{.*\}))?\s*$/;
// YAML shorthand option :key: value
const SHORTHAND_RE = /^:([\w-]+):\s*(.*)/;

const CELL_DIRECTIVES = new Set(["code-cell", "raw-cell", "markdown-cell"]);
/** Extract the human-readable label from a MyST role content string.
 *  ~some.dotted.path → last segment
 *  label <target>    → label
 *  plain text        → plain text
 */
function roleLabel(content: string): string {
  const angleMatch = content.match(/^(.+?)\s*<[^>]+>$/);
  if (angleMatch) return angleMatch[1].trim();
  if (content.startsWith("~")) {
    const parts = content.slice(1).split(".");
    return parts[parts.length - 1];
  }
  return content;
}

/** Substitute MyST inline syntax into readable plain Markdown. */
function substituteInlineRoles(line: string): string {
  // {math}`expr` → $expr$  (must run before the catch-all below)
  line = line.replace(/\{math\}`([^`]*)`/g, (_, expr) => `$${expr}$`);

  // {cite}`label` → remove (bibliography references add no value in a notebook)
  line = line.replace(/\{cite\}`[^`]*`/g, "");

  // {{ var }} → var  (substitution references — values not available)
  line = line.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => name);

  // All remaining inline roles → plain display text
  line = line.replace(/\{[\w-]+\}`([^`]*)`/g, (_, content) => roleLabel(content));

  return line;
}


function stripTrailingBlank(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return lines.slice(0, end);
}

export function parseMystMd(text: string): Notebook {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cells: Cell[] = [];
  const used = new Set<string>();
  let notebookMeta: Record<string, unknown> = {};

  const mdLines: string[] = [];
  let pendingMeta: Record<string, unknown> = {};

  function flushMarkdown() {
    const trimmed = mdLines.join("\n").trim();
    if (trimmed) cells.push(markdownCell(trimmed, pendingMeta, used));
    mdLines.length = 0;
    pendingMeta = {};
  }

  let i = 0;

  // Strip notebook-level front matter (---...---)
  if (lines[0] === "---") {
    i = 1;
    const fmLines: string[] = [];
    while (i < lines.length && lines[i] !== "---") {
      fmLines.push(lines[i]);
      i++;
    }
    i++; // skip closing ---
    notebookMeta = parseYAMLBlock(fmLines);
  }

  while (i < lines.length) {
    const line = lines[i];

    // +++ cell break
    const breakMatch = line.match(CELL_BREAK_RE);
    if (breakMatch) {
      // Flush current markdown with its (empty) metadata, then set pending
      // metadata for the NEXT cell that accumulates after this break
      flushMarkdown();
      if (breakMatch[1]) {
        try {
          pendingMeta = JSON.parse(breakMatch[1]);
        } catch {
          /* ignore */
        }
      }
      i++;
      continue;
    }

    // ```{directive} ...
    const dirMatch = line.match(DIRECTIVE_OPEN_RE);
    if (dirMatch) {
      const fence = dirMatch[1];
      const directive = dirMatch[2];

      // {math} block → convert to $$ display math
      if (directive === "math") {
        i++;
        const mathLines: string[] = [];
        while (i < lines.length && !isClosingFence(lines[i], fence)) {
          mathLines.push(lines[i]);
          i++;
        }
        i++; // skip closing fence
        const inner = stripTrailingBlank(mathLines).join("\n");
        mdLines.push("$$");
        if (inner) mdLines.push(inner);
        mdLines.push("$$");
        continue;
      }

      // Other non-cell directives ({note}, {try_on_binder}, etc.) stay as markdown text
      if (!CELL_DIRECTIVES.has(directive)) {
        mdLines.push(line);
        i++;
        continue;
      }

      flushMarkdown();
      i++;

      // Collect shorthand options (:key: value) or YAML block (---...---)
      const optionLines: string[] = [];

      if (lines[i] === "---") {
        i++;
        while (i < lines.length && lines[i] !== "---") {
          optionLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ---
      } else {
        while (i < lines.length && SHORTHAND_RE.test(lines[i])) {
          const m = lines[i].match(SHORTHAND_RE)!;
          optionLines.push(`${m[1]}: ${m[2]}`);
          i++;
        }
      }

      const cellMeta = parseYAMLBlock(optionLines);

      // Skip blank line after options
      if (i < lines.length && lines[i].trim() === "") i++;

      // Collect content until closing fence
      const contentLines: string[] = [];
      while (i < lines.length && !isClosingFence(lines[i], fence)) {
        contentLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence

      const source = stripTrailingBlank(contentLines).join("\n");

      if (directive === "code-cell") {
        cells.push(codeCell(source, cellMeta, used));
      } else if (directive === "raw-cell") {
        cells.push(rawCell(source, cellMeta, used));
      } else {
        cells.push(markdownCell(source, cellMeta, used));
      }
      continue;
    }

    mdLines.push(substituteInlineRoles(line));
    i++;
  }

  flushMarkdown();
  return makeNotebook(cells, notebookMeta);
}

function isClosingFence(line: string, fence: string): boolean {
  return line.startsWith(fence) && line.slice(fence.length).trim() === "";
}
