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
import { detectFormat } from "./detect";
import { toPy } from "./toPy";
import { toMystMd } from "./toMystMd";
import { toSphinxGallery } from "./toSphinxGallery";
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
 * Parse a file by auto-detecting its format from the text and extension.
 *
 * @param text - the file contents
 * @param ext - the file extension, with or without a leading dot (e.g. ".py")
 */
export function parseAuto(text: string, ext: string): Notebook {
  switch (detectFormat(text, ext)) {
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
