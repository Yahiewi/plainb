// ---------------------------------------------------------------------------
// Shared utility functions
// ---------------------------------------------------------------------------

type YAMLObject = Record<string, unknown>;

/**
 * Merges multi-line flow arrays in YAML lines by counting brackets.
 */
function preprocessYamlLines(yamlLines: string[]): string[] {
  const merged: string[] = [];
  let currentLine = "";

  for (const rawLine of yamlLines) {
    if (currentLine === "") {
      currentLine = rawLine;
    } else {
      currentLine += "\n" + rawLine;
    }

    let openBrackets = 0;
    let closeBrackets = 0;
    let inDoubleQuotes = false;
    let inSingleQuotes = false;

    for (let c = 0; c < currentLine.length; c++) {
      const char = currentLine[c];
      const prevChar = currentLine[c - 1] ?? "";
      if (char === '"' && prevChar !== '\\' && !inSingleQuotes) {
        inDoubleQuotes = !inDoubleQuotes;
      } else if (char === "'" && prevChar !== '\\' && !inDoubleQuotes) {
        inSingleQuotes = !inSingleQuotes;
      } else if (!inDoubleQuotes && !inSingleQuotes) {
        if (char === "[") {
          openBrackets++;
        } else if (char === "]") {
          closeBrackets++;
        }
      }
    }

    if (openBrackets === closeBrackets) {
      merged.push(currentLine);
      currentLine = "";
    }
  }

  if (currentLine !== "") {
    merged.push(currentLine);
  }
  return merged;
}

/**
 * Decodes double-quoted strings with PyYAML-style hex escapes (\xHH) into Unicode.
 */
function parseDoubleQuotedString(s: string): string {
  const converted = s.replace(/\\x([0-9a-fA-F]{2})/g, "\\u00$1");
  try {
    return JSON.parse(converted);
  } catch {
    return s.slice(1, -1);
  }
}

/**
 * Encodes non-ASCII characters inside double-quoted strings into PyYAML hex escapes.
 */
function escapeNonAsciiYAML(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);
    if (code > 127) {
      if (code <= 255) {
        result += "\\x" + code.toString(16).toUpperCase();
      } else {
        result += "\\u" + code.toString(16).padStart(4, "0").toUpperCase();
      }
    } else {
      if (char === '"' || char === '\\') {
        result += "\\" + char;
      } else {
        result += char;
      }
    }
  }
  return `"${result}"`;
}

/**
 * Parse a multiline YAML block (or frontmatter) into a nested object structure.
 */
export function parseYAMLBlock(yamlLines: string[]): YAMLObject {
  const root: YAMLObject = {};
  const stack: { indent: number; obj: YAMLObject }[] = [{ indent: -1, obj: root }];
  const processedLines = preprocessYamlLines(yamlLines);

  for (const rawLine of processedLines) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed || trimmed.trim().startsWith("#")) {
      continue;
    }

    const indent = rawLine.length - rawLine.trimStart().length;

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1].obj;

    const match = trimmed.trim().match(/^([^:]+):\s*(.*)$/s);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const valueStr = match[2].trim();

    if (valueStr === "") {
      const newObj: YAMLObject = {};
      currentParent[key] = newObj;
      stack.push({ indent, obj: newObj });
    } else {
      let parsedVal: unknown = valueStr;
      if (
        (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))
      ) {
        parsedVal = parseDoubleQuotedString(valueStr);
      } else if (valueStr.startsWith("[") && valueStr.endsWith("]")) {
        try {
          parsedVal = JSON.parse(valueStr);
        } catch {
          parsedVal = valueStr
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim())
            .map((s) => {
              if (
                (s.startsWith('"') && s.endsWith('"')) ||
                (s.startsWith("'") && s.endsWith("'"))
              ) {
                return parseDoubleQuotedString(s);
              }
              return s;
            });
        }
      } else {
        try {
          parsedVal = JSON.parse(valueStr);
        } catch {
          // Keep as raw string
        }
      }
      currentParent[key] = parsedVal;
    }
  }

  if (root.jupyter && typeof root.jupyter === "object") {
    return root.jupyter as YAMLObject;
  }

  return root;
}

/**
 * Serialize a nested dictionary/object structure to an indentation-based YAML string.
 */
export function stringifyYAML(obj: YAMLObject, depth = 0): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) {
      continue;
    }
    if (Array.isArray(val)) {
      const items = val.map((item) => {
        if (typeof item === "string") {
          if (/^[a-zA-Z0-9_-]+$/.test(item)) {
            return item;
          }
          return escapeNonAsciiYAML(item);
        }
        return JSON.stringify(item);
      }).join(", ");
      lines.push(`${indent}${key}: [${items}]`);
    } else if (val && typeof val === "object") {
      lines.push(`${indent}${key}:`);
      const nested = stringifyYAML(val as YAMLObject, depth + 1);
      if (nested) {
        lines.push(nested);
      }
    } else if (typeof val === "string") {
      const isNumeric = !isNaN(Number(val)) && !isNaN(parseFloat(val));
      const isBoolOrNull = val === "true" || val === "false" || val === "null";
      const hasNonAscii = /[^\x00-\x7F]/.test(val);
      if (hasNonAscii) {
        lines.push(`${indent}${key}: ${escapeNonAsciiYAML(val)}`);
      } else if (/[:#[\]{}|>&*?]/g.test(val) || val.trim() !== val || isNumeric || isBoolOrNull) {
        lines.push(`${indent}${key}: ${JSON.stringify(val)}`);
      } else {
        lines.push(`${indent}${key}: ${val}`);
      }
    } else {
      lines.push(`${indent}${key}: ${val}`);
    }
  }

  return lines.join("\n");
}

/**
 * Format JSON objects with spaces after colons and commas to match Python's formatting.
 */
export function pythonStyleJSON(val: unknown): string {
  if (val === null) {
    return "null";
  }
  if (typeof val === "string") {
    return JSON.stringify(val);
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return "[" + val.map(pythonStyleJSON).join(", ") + "]";
  }
  if (typeof val === "object") {
    const entries = Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => `${JSON.stringify(k)}: ${pythonStyleJSON(v)}`)
      .join(", ");
    return "{" + entries + "}";
  }
  return "";
}

/**
 * Filter out transient cell metadata keys
 */
export function cleanCellMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...meta };
  const keysToFilter = [
    "trusted",
    "collapsed",
    "scrolled",
    "autoscroll",
    "ExecuteTime",
    "execution",
    "heading_collapsed",
    "jp-MarkdownHeadingCollapsed",
    "user_expressions"
  ];
  for (const key of keysToFilter) {
    delete clean[key];
  }
  return clean;
}
