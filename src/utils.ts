// ---------------------------------------------------------------------------
// Shared utility functions
// ---------------------------------------------------------------------------

/**
 * Parse a flat list of `key: value` YAML lines into a plain object.
 * Values that look like JSON (objects, arrays, numbers, booleans) are parsed
 * back into their native types so that nested metadata (e.g. `kernelspec`)
 * roundtrips correctly instead of being stored as a raw string.
 */
export function parseFrontMatter(yamlLines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yamlLines) {
    const m = line.match(/^([\w-]+):\s*(.*)/);
    if (m) {
      const val = m[2].trim();
      try {
        result[m[1]] = JSON.parse(val);
      } catch {
        result[m[1]] = val;
      }
    }
  }
  return result;
}
