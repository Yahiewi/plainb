import { codeCell, markdownCell, makeNotebook, type Cell, type Notebook } from "./notebook";
import { parseYAMLBlock } from "./utils";

// ---------------------------------------------------------------------------
// RST helpers
// ---------------------------------------------------------------------------

// RST underline character → markdown heading prefix
const RST_HEADING: Record<string, string> = {
  "=": "#",
  "-": "##",
  "^": "###",
  "~": "####",
  '"': "#####",
};

function isRstUnderline(s: string): boolean {
  return s.length >= 2 && /^([-=^~"*+#`'!])\1+$/.test(s);
}

/** Convert RST overline/underline headings to Markdown headings (in-place). */
function rstHeadingsToMd(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    const nxt = lines[i + 1] ?? "";
    const aft = lines[i + 2] ?? "";

    // Overline + title + underline (===\nTitle\n===)
    if (isRstUnderline(cur) && nxt.trim() && isRstUnderline(aft) && cur[0] === aft[0]) {
      out.push(`${RST_HEADING[cur[0]] ?? "#"} ${nxt.trim()}`);
      i += 3;
      continue;
    }

    // Title + underline (Title\n---)
    if (cur.trim() && isRstUnderline(nxt)) {
      out.push(`${RST_HEADING[nxt[0]] ?? "##"} ${cur.trim()}`);
      i += 2;
      continue;
    }

    out.push(cur);
    i++;
  }
  return out;
}

/** Extract display label from RST role content string. */
function rstRoleLabel(content: string): string {
  // `label <target>`_ or label <target>
  const angleMatch = content.match(/^(.+?)\s*<[^>]+>`?_?$/);
  if (angleMatch) return angleMatch[1].trim().replace(/^`/, "");
  // ~some.dotted.path → last segment
  if (content.startsWith("~")) {
    const parts = content.slice(1).split(".");
    return parts[parts.length - 1];
  }
  return content;
}

/** Strip RST inline roles (:role:`content`) to plain readable text. */
function substituteRstRoles(line: string): string {
  return line.replace(/:[\w-]+:`([^`]*)`/g, (_, content) => rstRoleLabel(content));
}

// ---------------------------------------------------------------------------
// Comment/docstring stripping
// ---------------------------------------------------------------------------

function uncomment(lines: string[]): string[] {
  return lines.map((l) => (l === "#" ? "" : l.startsWith("# ") ? l.slice(2) : l));
}

function stripTrailingBlank(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return lines.slice(0, end);
}

function stripLeadingBlank(lines: string[]): string[] {
  let start = 0;
  while (start < lines.length && lines[start].trim() === "") start++;
  return lines.slice(start);
}

/** Extract the module-level triple-quoted docstring. */
function extractDocstring(lines: string[]): { content: string; end: number } | null {
  const first = lines[0] ?? "";
  const isRaw = first.startsWith('r"""');
  if (!first.startsWith('"""') && !isRaw) return null;

  const afterOpen = isRaw ? first.slice(4) : first.slice(3);
  const sameLineClose = afterOpen.indexOf('"""');
  if (sameLineClose >= 0) {
    return { content: afterOpen.slice(0, sameLineClose), end: 1 };
  }

  const contentLines: string[] = afterOpen ? [afterOpen] : [];
  for (let i = 1; i < lines.length; i++) {
    const ci = lines[i].indexOf('"""');
    if (ci >= 0) {
      if (ci > 0) contentLines.push(lines[i].slice(0, ci));
      return { content: contentLines.join("\n"), end: i + 1 };
    }
    contentLines.push(lines[i]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

const DELIMITER_RE = /^(?:#\s*%%(.*)|#{20,}.*)$/;

export function parseSphinxGallery(text: string): Notebook {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cells: Cell[] = [];
  const used = new Set<string>();
  let notebookMeta: Record<string, unknown> = {};

  let i = 0;

  // Check for commented YAML front matter at the top
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

  // Skip any leading empty lines before checking for docstring
  while (i < lines.length && lines[i].trim() === "") {
    i++;
  }

  // 1. Module docstring → first markdown cell
  const ds = extractDocstring(lines.slice(i));
  if (ds) {
    const raw = ds.content.split("\n");
    const converted = rstHeadingsToMd(raw).map(substituteRstRoles);
    const trimmed = stripTrailingBlank(stripLeadingBlank(converted)).join("\n");
    if (trimmed) cells.push(markdownCell(trimmed, {}, used));
    i += ds.end;
  }

  // 2. Collect delimiter positions
  const delimiters: number[] = [];
  if (lines.some((line) => DELIMITER_RE.test(line))) {
    // Skip lines before first # %% (authors, SPDX, blanks)
    while (i < lines.length && !DELIMITER_RE.test(lines[i])) i++;
    for (let j = i; j < lines.length; j++) {
      if (DELIMITER_RE.test(lines[j])) delimiters.push(j);
    }
  } else if (i < lines.length) {
    // No delimiters, but we have code/content left. Treat everything as one cell
    delimiters.push(i - 1);
  }

  // 4. Process each section
  for (let d = 0; d < delimiters.length; d++) {
    const start = delimiters[d] + 1;
    const end = d + 1 < delimiters.length ? delimiters[d + 1] : lines.length;
    const section = lines.slice(start, end);

    // Split: leading comment lines → markdown, rest → code
    let split = 0;
    while (split < section.length && section[split].startsWith("#")) split++;

    const commentLines = section.slice(0, split);

    // Skip blank separator between comment block and code
    let codeStart = split;
    while (codeStart < section.length && section[codeStart].trim() === "") codeStart++;
    const codeLines = stripTrailingBlank(section.slice(codeStart));

    if (commentLines.length > 0) {
      const raw = uncomment(commentLines);
      const converted = rstHeadingsToMd(raw).map(substituteRstRoles);
      const mdText = stripTrailingBlank(converted).join("\n").trim();
      if (mdText) cells.push(markdownCell(mdText, {}, used));
    }

    if (codeLines.length > 0) {
      cells.push(codeCell(codeLines.join("\n"), {}, used));
    }
  }

  return makeNotebook(cells, notebookMeta);
}
