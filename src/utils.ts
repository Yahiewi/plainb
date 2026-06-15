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
      if (char === '"' && prevChar !== "\\" && !inSingleQuotes) {
        inDoubleQuotes = !inDoubleQuotes;
      } else if (char === "'" && prevChar !== "\\" && !inDoubleQuotes) {
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
      if (char === '"' || char === "\\") {
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
      const items = val
        .map((item) => {
          if (typeof item === "string") {
            if (/^[a-zA-Z0-9_-]+$/.test(item)) {
              return item;
            }
            return escapeNonAsciiYAML(item);
          }
          return JSON.stringify(item);
        })
        .join(", ");
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
      // eslint-disable-next-line no-control-regex
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
    "autoscroll",
    "collapsed",
    "scrolled",
    "trusted",
    "ExecuteTime"
  ];
  for (const key of keysToFilter) {
    delete clean[key];
  }
  return clean;
}

interface FilterRule {
  isNegated: boolean;
  keys: string[];
}

/**
 * Evaluates a metadata key path against the filter rules to determine the action:
 * - "include": keep the value as-is.
 * - "exclude": drop the value.
 * - "traverse": recurse into the nested object to apply more specific rules.
 */
function getPathAction(path: string[], rules: FilterRule[], defaultInclude: boolean): "include" | "exclude" | "traverse" {
  // Check if there are any descendant rules (eg. nbgrader.grade)
  const hasDescendantRule = rules.some((rule) => {
    if (rule.keys.length > path.length) {
      return path.every((k, i) => rule.keys[i] === k);
    }
    return false;
  });

  // Find the most specific rule that is a prefix (or equal) of the path
  let bestMatchingRule: FilterRule | null = null;
  for (const rule of rules) {
    if (rule.keys.length <= path.length) {
      const isPrefix = rule.keys.every((k, i) => path[i] === k);
      if (isPrefix) {
        if (!bestMatchingRule || rule.keys.length > bestMatchingRule.keys.length) {
          bestMatchingRule = rule;
        }
      }
    }
  }

  if (bestMatchingRule) {
    if (bestMatchingRule.isNegated) {
      if (hasDescendantRule) {
        return "traverse";
      }
      return "exclude";
    } else {
      return "include";
    }
  }

  if (hasDescendantRule) {
    return "traverse";
  }

  return defaultInclude ? "include" : "exclude";
}

/**
 * Filters metadata keys according to a Jupytext filter string.
 * Supports positive/negative filters, all/none, and nested keys via dot-notation.
 */
export function filterMetadata(meta: Record<string, unknown>, filterStr: string): Record<string, unknown> {
  if (!filterStr || typeof filterStr !== "string") {
    return meta;
  }

  const parts = filterStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rules: FilterRule[] = [];
  let defaultInclude = false;
  let hasAll = false;
  let hasMinusAll = false;
  let hasNone = false;
  let hasMinusNone = false;

  for (const part of parts) {
    if (part === "all") {
      hasAll = true;
    } else if (part === "-all") {
      hasMinusAll = true;
    } else if (part === "none") {
      hasNone = true;
    } else if (part === "-none") {
      hasMinusNone = true;
    } else {
      const isNegated = part.startsWith("-");
      const cleanPart = isNegated ? part.slice(1) : part;
      rules.push({
        isNegated,
        keys: cleanPart
          .split(".")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
  }

  if (hasAll) {
    defaultInclude = true;
  } else if (hasMinusAll || hasNone) {
    defaultInclude = false;
  } else if (hasMinusNone) {
    defaultInclude = true;
  } else {
    if (parts.length > 0 && parts[0].startsWith("-")) {
      defaultInclude = true;
    } else {
      defaultInclude = false;
    }
  }

  /**
   * Recursively traverses and filters a metadata object tree using path evaluation actions.
   */
  function recurse(obj: Record<string, unknown>, currentPath: string[]): Record<string, unknown> {
    const res: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const path = [...currentPath, key];
      const action = getPathAction(path, rules, defaultInclude);
      if (action === "include") {
        res[key] = value;
      } else if (action === "traverse") {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          res[key] = recurse(value as Record<string, unknown>, path);
        } else {
          res[key] = value;
        }
      }
    }
    return res;
  }

  return recurse(meta, []);
}
