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
// Percent format parser
// ---------------------------------------------------------------------------

// Matches: # %% optional-rest
const DELIMITER_RE = /^# %%(.*)$/;

// Matches cell type tag: [markdown], [md], [raw]
const TYPE_TAG_RE = /\[(\w+)\]/;

type CellType = "code" | "markdown" | "raw";

interface CellHeader {
  cellType: CellType;
  metadata: Record<string, unknown>;
}

function parseCellHeader(rest: string): CellHeader {
  let s = rest.trim();
  let cellType: CellType = "code";

  const typeMatch = s.match(TYPE_TAG_RE);
  if (typeMatch) {
    const t = typeMatch[1].toLowerCase();
    if (t === "markdown" || t === "md") cellType = "markdown";
    else if (t === "raw") cellType = "raw";
    s = s.replace(TYPE_TAG_RE, "").trim();
  }

  let metadata: Record<string, unknown> = {};

  const firstCurly = s.indexOf("{");
  const firstEqual = s.indexOf("=");

  if (firstCurly >= 0 && (firstEqual < 0 || firstCurly < firstEqual)) {
    const jsonStr = s.slice(firstCurly);
    const titleStr = s.slice(0, firstCurly).trim();
    try {
      metadata = JSON.parse(jsonStr);
    } catch {
      // ignore
    }
    if (titleStr) {
      metadata.name = titleStr;
    }
  } else {
    const kvRegex = /\b([\w-]+)=("[^"]*"|'[^']*'|\[[^\]]*\]|\S+)/g;
    const matches = Array.from(s.matchAll(kvRegex));
    let remaining = s;
    for (const match of matches) {
      const key = match[1];
      const valStr = match[2];
      remaining = remaining.replace(match[0], "");

      let parsedVal: unknown;
      const strippedVal = valStr.replace(/^['"]|['"]$/g, "");
      try {
        const normVal = strippedVal.replace(/'/g, '"');
        parsedVal = JSON.parse(normVal);
      } catch {
        parsedVal = strippedVal;
      }
      metadata[key] = parsedVal;
    }
    const nameStr = remaining.replace(/\s+/g, " ").trim();
    if (nameStr) {
      metadata.name = nameStr;
    }
  }

  return { cellType, metadata };
}

/** Strip leading `# ` (or bare `#`) comment prefix from markdown/raw cell lines. */
function uncomment(lines: string[]): string {
  return lines
    .map((line) => {
      if (line === "#") return "";
      if (line.startsWith("# ")) return line.slice(2);
      return line;
    })
    .join("\n");
}

/** Strip triple-quote wrappers from markdown cell content. */
function stripTripleQuotes(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  if (lines[0]?.trim() === '"""') start = 1;
  if (lines[end - 1]?.trim() === '"""') end -= 1;
  return lines.slice(start, end).join("\n");
}

function stripTrailingBlank(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return lines.slice(0, end);
}

export function parsePy(text: string): Notebook {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cells: Cell[] = [];
  const used = new Set<string>();
  let notebookMeta: Record<string, unknown> = {};

  // Check for commented YAML front matter at the top
  let i = 0;
  if (lines[0] === "# ---") {
    i = 1;
    const fmLines: string[] = [];
    while (i < lines.length && lines[i] !== "# ---") {
      fmLines.push(lines[i].replace(/^#\s?/, ""));
      i++;
    }
    i++; // skip closing # ---
    notebookMeta = parseYAMLBlock(fmLines);
  }

  // Find all delimiter positions
  const contentStart = i;
  const delimiters: Array<{ idx: number; rest: string }> = [];
  for (; i < lines.length; i++) {
    const m = lines[i].match(DELIMITER_RE);
    if (m) delimiters.push({ idx: i, rest: m[1] });
  }

  if (delimiters.length === 0) {
    // No delimiters — entire file is one code cell
    const source = lines.slice(contentStart).join("\n");
    if (source.trim()) cells.push(codeCell(source, {}, used));
    return makeNotebook(cells, notebookMeta);
  }

  for (let d = 0; d < delimiters.length; d++) {
    const start = delimiters[d].idx + 1;
    const end = d + 1 < delimiters.length ? delimiters[d + 1].idx : lines.length;

    const { cellType, metadata } = parseCellHeader(delimiters[d].rest);
    const rawLines = stripTrailingBlank(lines.slice(start, end));

    if (cellType === "code") {
      const source = rawLines.join("\n");
      if (source.trim()) cells.push(codeCell(source, metadata, used));
    } else {
      // markdown or raw
      const isTripleQuote = rawLines[0]?.trim() === '"""';
      const source = isTripleQuote ? stripTripleQuotes(rawLines) : uncomment(rawLines);
      if (cellType === "markdown") {
        cells.push(markdownCell(source, metadata, used));
      } else {
        cells.push(rawCell(source, metadata, used));
      }
    }
  }

  return makeNotebook(cells, notebookMeta);
}
