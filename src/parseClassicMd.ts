import { codeCell, markdownCell, makeNotebook, type Cell, type Notebook } from "./notebook.js";
import { parseYAMLBlock } from "./utils.js";

// ---------------------------------------------------------------------------
// Classic markdown parser
// Two states: MARKDOWN | IN_FENCE
// Only language-tagged fences (```python, ```js, etc.) become code cells.
// Untagged fences stay as markdown text.
// ---------------------------------------------------------------------------

// Opening fence with a required language identifier
const OPENING_FENCE_RE = /^(`{3,})(\w[\w.-]*)\s*$/;
// Generic fence close (same or longer fence)
function isClosingFence(line: string, fence: string): boolean {
  return line.startsWith(fence) && line.slice(fence.length).trim() === "";
}

export function parseClassicMd(text: string): Notebook {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cells: Cell[] = [];
  const used = new Set<string>();
  let notebookMeta: Record<string, unknown> = {};

  const mdLines: string[] = [];

  function flushMarkdown() {
    const trimmed = mdLines.join("\n").trim();
    if (trimmed) cells.push(markdownCell(trimmed, {}, used));
    mdLines.length = 0;
  }

  let i = 0;

  // Strip and parse notebook-level front matter (---...---) if present
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
    const fenceMatch = line.match(OPENING_FENCE_RE);

    if (fenceMatch) {
      const fence = fenceMatch[1]; // e.g. "```"
      flushMarkdown();

      // Collect code lines until closing fence
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !isClosingFence(lines[i], fence)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence (or EOF)

      // Strip trailing blank lines from code
      let end = codeLines.length;
      while (end > 0 && codeLines[end - 1].trim() === "") end--;
      const source = codeLines.slice(0, end).join("\n");
      cells.push(codeCell(source, {}, used));
    } else {
      mdLines.push(line);
      i++;
    }
  }

  flushMarkdown();
  return makeNotebook(cells, notebookMeta);
}
