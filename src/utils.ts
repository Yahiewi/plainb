// ---------------------------------------------------------------------------
// Shared utility functions
// ---------------------------------------------------------------------------

type YAMLObject = Record<string, unknown>;

/**
 * Parse a multiline YAML frontmatter string array into a nested object structure.
 * Uses jupyter namespace for compatibility with Jupytext metadata format.
 */
export function parseFrontMatter(yamlLines: string[]): YAMLObject {
  const root: YAMLObject = {};
  // Stack contains objects and their indentation level
  const stack: { indent: number; obj: YAMLObject }[] = [
    { indent: -1, obj: root }
  ];

  for (const rawLine of yamlLines) {
    const trimmed = rawLine.trimEnd();
    if (!trimmed || trimmed.trim().startsWith('#')) {
      continue; // skip blank lines and comments
    }

    // Calculate indentation level
    const indent = rawLine.length - rawLine.trimStart().length;

    // Pop from stack until we find the parent (indentation < current indent)
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const currentParent = stack[stack.length - 1].obj;

    // Match the first colon as key-value separator, allowing dots/quotes/spaces in keys
    const match = trimmed.trim().match(/^([^:]+):\s*(.*)$/);
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
      if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
        parsedVal = valueStr.slice(1, -1);
      } else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
        try {
          parsedVal = JSON.parse(valueStr);
        } catch {
          // Flow array fallback: split by comma and clean quotes
          parsedVal = valueStr
            .slice(1, -1)
            .split(',')
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''));
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

  // Return the nested `jupyter` namespace directly if present, otherwise the root object
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
      const items = val.map(item => JSON.stringify(item)).join(", ");
      lines.push(`${indent}${key}: [${items}]`);
    } else if (val && typeof val === "object") {
      lines.push(`${indent}${key}:`);
      const nested = stringifyYAML(val as YAMLObject, depth + 1);
      if (nested) {
        lines.push(nested);
      }
    } else if (typeof val === "string") {
      // If it contains YAML special characters, or looks like a number/bool/null, serialise as JSON string (quoted)
      const isNumeric = !isNaN(Number(val)) && !isNaN(parseFloat(val));
      const isBoolOrNull = val === "true" || val === "false" || val === "null";
      if (/[:#[\]{}|>&*?]/g.test(val) || val.trim() !== val || isNumeric || isBoolOrNull) {
        lines.push(`${indent}${key}: ${JSON.stringify(val)}`);
      } else {
        lines.push(`${indent}${key}: ${val}`);
      }
    } else {
      // Boolean, number
      lines.push(`${indent}${key}: ${val}`);
    }
  }

  return lines.join("\n");
}
