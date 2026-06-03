export * from "./parsePy";
export * from "./parseMd";
export * from "./parseClassicMd";
export * from "./parseMystMd";
export * from "./parseSphinxGallery";
export * from "./notebook";
export * from "./detect";
export * from "./toPy";
export * from "./toClassicMd";
export * from "./toMystMd";
export * from "./toSphinxGallery";

import { parsePy } from "./parsePy";
import { parseMd } from "./parseMd";
import { parseClassicMd } from "./parseClassicMd";
import { parseMystMd } from "./parseMystMd";
import { parseSphinxGallery } from "./parseSphinxGallery";
import { toPy } from "./toPy";
import { toClassicMd } from "./toClassicMd";
import { toMystMd } from "./toMystMd";
import { toSphinxGallery } from "./toSphinxGallery";
import type { PlainbFormat } from "./detect";
import type { Notebook } from "./notebook";

/**
 * Parse a file by explicitly providing the format.
 *
 * @param text - the file contents
 * @param format - the format of the file, "py", "md", or "sphinx-gallery"
 */
export function parse(text: string, format: "py" | "md" | "sphinx-gallery"): Notebook {
  if (format === "py") return parsePy(text);
  if (format === "md") return parseMd(text);
  if (format === "sphinx-gallery") return parseSphinxGallery(text);
  throw new Error(`Unknown format: "${format}". Expected "py", "md", or "sphinx-gallery".`);
}

/**
 * Serialize a notebook to a file by explicitly providing the format.
 *
 * @param notebook - the notebook to serialize
 * @param format - the format to serialize to, "py", "md", or "sphinx-gallery"
 */
export function serialize(notebook: Notebook, format: "py" | "md" | "sphinx-gallery"): string {
  if (format === "py") return toPy(notebook);
  if (format === "md") return toMystMd(notebook);
  if (format === "sphinx-gallery") return toSphinxGallery(notebook);
  throw new Error(`Unknown format: "${format}". Expected "py", "md", or "sphinx-gallery".`);
}

/**
 * Parse a file given its detected {@link PlainbFormat}.
 *
 * @param text - the file contents
 * @param format - the format returned by {@link detectFormat}
 */
export function parseFormat(text: string, format: PlainbFormat): Notebook {
  switch (format) {
    case "percent":
      return parsePy(text);
    case "sphinx-gallery":
      return parseSphinxGallery(text);
    case "myst":
      return parseMystMd(text);
    case "classic":
      return parseClassicMd(text);
  }
}

/**
 * Serialize a notebook to a given {@link PlainbFormat}.
 *
 * @param notebook - the notebook to serialize
 * @param format - the target format
 */
export function serializeFormat(notebook: Notebook, format: PlainbFormat): string {
  switch (format) {
    case "percent":
      return toPy(notebook);
    case "sphinx-gallery":
      return toSphinxGallery(notebook);
    case "myst":
      return toMystMd(notebook);
    case "classic":
      return toClassicMd(notebook);
  }
}
