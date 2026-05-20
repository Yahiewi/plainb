import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseSphinxGallery } from "../src/parseSphinxGallery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(resolve(__dirname, "outputs"), { recursive: true });
const text = readFileSync(
  resolve(__dirname, "inputs/calibration_curves.py"),
  "utf8"
);
const nb = parseSphinxGallery(text);

writeFileSync(
  resolve(__dirname, "outputs/calibration_curves.ipynb"),
  JSON.stringify(nb, null, 2)
);

const codeCells = nb.cells.filter((c) => c.cell_type === "code");
const mdCells = nb.cells.filter((c) => c.cell_type === "markdown");
const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n---\n");

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

test("parses without error", () => {
  assert.ok(nb);
  assert.equal(nb.nbformat, 4);
  assert.equal(nb.nbformat_minor, 5);
});

test("first cell is markdown from module docstring", () => {
  assert.equal(nb.cells[0].cell_type, "markdown");
  const src = nb.cells[0].source.join("");
  assert.ok(src.includes("Probability Calibration curves"), "title present");
});

test("module docstring RST overline/underline converted to # heading", () => {
  const src = nb.cells[0].source.join("");
  assert.ok(src.includes("# Probability Calibration curves"), "h1 heading");
  assert.ok(!src.includes("===="), "RST underline removed");
});

test("section headings converted from RST to ##/###", () => {
  assert.ok(allMdSrc.includes("## Dataset"), "## Dataset");
  assert.ok(allMdSrc.includes("## Calibration curves"), "## Calibration curves");
  assert.ok(allMdSrc.includes("### Gaussian Naive Bayes"), "### Gaussian Naive Bayes");
  assert.ok(!allMdSrc.includes("-------"), "RST dashes removed");
  assert.ok(!allMdSrc.includes("^^^^^^^"), "RST carets removed");
});

test("no RST inline roles remain", () => {
  assert.ok(!allMdSrc.includes(":class:`"), "no :class: roles");
  assert.ok(!allMdSrc.includes(":ref:`"), "no :ref: roles");
  assert.ok(!allMdSrc.includes(":term:`"), "no :term: roles");
  assert.ok(!allMdSrc.includes(":meth:`"), "no :meth: roles");
});

test(":class: with ~ resolved to short name", () => {
  // :class:`~sklearn.naive_bayes.GaussianNB` → GaussianNB
  assert.ok(allMdSrc.includes("GaussianNB"), "GaussianNB present");
  assert.ok(allMdSrc.includes("LogisticRegression"), "LogisticRegression present");
});

test(":ref: with label <target> resolved to label", () => {
  // :ref:`User Guide <calibration>` → User Guide
  assert.ok(allMdSrc.includes("User Guide"), "User Guide present");
});

test("Authors/SPDX lines not in any cell", () => {
  const allSrc = nb.cells.map((c) => c.source.join("")).join("\n");
  assert.ok(!allSrc.includes("# Authors:"), "authors line skipped");
  assert.ok(!allSrc.includes("SPDX-License-Identifier"), "SPDX line skipped");
});

test("code cells contain actual Python code", () => {
  const allCodeSrc = codeCells.map((c) => c.source.join("")).join("\n");
  assert.ok(allCodeSrc.includes("from sklearn"), "sklearn imports present");
  assert.ok(allCodeSrc.includes("plt.show()"), "matplotlib calls present");
});

test("all code cells have outputs and execution_count", () => {
  for (const cell of codeCells) {
    const c = cell as any;
    assert.deepEqual(c.outputs, []);
    assert.equal(c.execution_count, null);
  }
});

test("all cell ids unique", () => {
  const ids = nb.cells.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("source lines correctly terminated", () => {
  for (const cell of nb.cells) {
    const src = cell.source;
    for (let i = 0; i < src.length - 1; i++) {
      assert.ok(src[i].endsWith("\n"), `cell ${cell.id} line ${i} ends with \\n`);
    }
    if (src.length > 0) {
      assert.ok(!src[src.length - 1].endsWith("\n"), "last line no trailing \\n");
    }
  }
});

test("output notebook written to test/outputs/calibration_curves.ipynb", () => {
  const written = readFileSync(
    resolve(__dirname, "outputs/calibration_curves.ipynb"),
    "utf8"
  );
  assert.equal(JSON.parse(written).nbformat, 4);
});

// ---------------------------------------------------------------------------
// Front-matter metadata (inline tests, no fixture file)
// ---------------------------------------------------------------------------

test("# --- front matter block parsed into notebook metadata", () => {
  const input = [
    "# ---",
    "# title: My Gallery",
    "# ---",
    '"""',
    "# My Gallery",
    '"""',
    "",
    "# %%",
    "x = 1"
  ].join("\n");
  const result = parseSphinxGallery(input);
  assert.equal(result.metadata.title, "My Gallery");
});

test("nested JSON in # --- front matter parsed back to object", () => {
  const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
  const input = [
    "# ---",
    `# kernelspec: ${JSON.stringify(kernelspec)}`,
    "# ---",
    '"""',
    "# Docs",
    '"""',
    "",
    "# %%",
    "x = 1"
  ].join("\n");
  const result = parseSphinxGallery(input);
  assert.deepEqual(result.metadata.kernelspec, kernelspec);
});

test("front matter does not appear as a cell", () => {
  const input = [
    "# ---",
    "# title: My Gallery",
    "# ---",
    '"""',
    "# Docs",
    '"""',
    "",
    "# %%",
    "x = 1"
  ].join("\n");
  const result = parseSphinxGallery(input);
  const allSrc = result.cells.map(c => c.source.join("")).join("");
  assert.ok(!allSrc.includes("title: My Gallery"), "front matter must not appear in any cell");
});

test("no front matter → empty metadata", () => {
  const input = '"""\nDocs.\n"""\n\n# %%\nx = 1\n';
  const result = parseSphinxGallery(input);
  assert.deepEqual(result.metadata, {});
});
