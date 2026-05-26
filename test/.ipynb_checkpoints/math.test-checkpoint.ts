import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parseMystMd } from "../src/parseMystMd.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

mkdirSync(resolve(__dirname, "outputs"), { recursive: true });
const text = readFileSync(resolve(__dirname, "inputs/math.md"), "utf8");
const nb = parseMystMd(text);

// Save output notebook to disk for inspection in VSCode
writeFileSync(
  resolve(__dirname, "outputs/math.ipynb"),
  JSON.stringify(nb, null, 2)
);

const codeCells = nb.cells.filter((c) => c.cell_type === "code");
const mdCells = nb.cells.filter((c) => c.cell_type === "markdown");

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

test("parses without error", () => {
  assert.ok(nb);
  assert.equal(nb.nbformat, 4);
  assert.equal(nb.nbformat_minor, 5);
});

test("39 code cells", () => {
  assert.equal(codeCells.length, 39);
});

test("notebook metadata from front matter", () => {
  assert.ok("jupytext" in nb.metadata || "kernelspec" in nb.metadata);
});

test("all cell ids unique", () => {
  const ids = nb.cells.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("all code cells have outputs and execution_count", () => {
  for (const cell of codeCells) {
    const c = cell as any;
    assert.deepEqual(c.outputs, []);
    assert.equal(c.execution_count, null);
  }
});

// ---------------------------------------------------------------------------
// First code cell: :load + :tags options
// ---------------------------------------------------------------------------

test("first code cell has :load and :tags metadata", () => {
  // First cell is a markdown cell ({try_on_binder}), second is the code cell
  const firstCode = codeCells[0];
  assert.equal(firstCode.cell_type, "code");
  assert.equal(firstCode.metadata.load, "myst_code_init.py");
  // tags may be string "[remove-cell]" or array — check it exists
  assert.ok("tags" in firstCode.metadata);
});

// ---------------------------------------------------------------------------
// {try_on_binder} — unknown directive stays in markdown
// ---------------------------------------------------------------------------

test("{try_on_binder} block stays in a markdown cell", () => {
  const src = mdCells.map((c) => c.source.join("")).join("\n---\n");
  assert.ok(src.includes("```{try_on_binder}"), "{try_on_binder} preserved");
});

// ---------------------------------------------------------------------------
// {math} blocks — 7 in file, all converted to $$ in markdown cells
// ---------------------------------------------------------------------------

test("all 7 {math} directive blocks converted to $$ in markdown", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  // No raw {math} directive fences should remain
  assert.ok(!allMdSrc.includes("```{math}"), "no raw {math} fences remain");
});

test("{math} block content preserved as $$ (backslashes, braces)", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(
    allMdSrc.includes("\\mathcal{M}"),
    "\\mathcal{M} present in markdown"
  );
  assert.ok(allMdSrc.includes("\\inf"), "\\inf present in markdown");
  assert.ok(allMdSrc.includes("$$"), "$$ wrapper present");
});

// ---------------------------------------------------------------------------
// $$ display math — preserved verbatim in markdown
// ---------------------------------------------------------------------------

test("$$ display math blocks preserved in markdown", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(allMdSrc.includes("$$"), "$$ display math found");
  assert.ok(
    allMdSrc.includes("\\inf_{v \\in V_N}"),
    "display math content preserved"
  );
});

// ---------------------------------------------------------------------------
// Inline role substitutions
// ---------------------------------------------------------------------------

test("no raw MyST inline roles remain in markdown", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(!allMdSrc.includes("{math}`"), "no {math}` roles");
  assert.ok(!allMdSrc.includes("{meth}`"), "no {meth}` roles");
  assert.ok(!allMdSrc.includes("{attr}`"), "no {attr}` roles");
  assert.ok(!allMdSrc.includes("{cite}`"), "no {cite}` roles");
  assert.ok(!allMdSrc.includes("{{"), "no {{ substitutions");
});

test("{math}` roles converted to $...$", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(allMdSrc.includes("$N$"), "$N$ present");
  assert.ok(allMdSrc.includes("$d_N(\\mathcal{M})$"), "$d_N(...) present");
});

test("{meth}` with ~ resolved to last segment", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  // {meth}`~pymor.models.interface.Model.solve` → solve
  assert.ok(allMdSrc.includes("solve"), "solve present");
});

test("{{ substitutions stripped to plain names", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(allMdSrc.includes("NumPy"), "NumPy present");
  assert.ok(allMdSrc.includes("VectorArrays"), "VectorArrays present");
});

// ---------------------------------------------------------------------------
// {note} block — unknown directive stays in markdown
// ---------------------------------------------------------------------------

test("{note} block stays in markdown", () => {
  const allMdSrc = mdCells.map((c) => c.source.join("")).join("\n");
  assert.ok(allMdSrc.includes("```{note}"), "{note} block preserved");
  assert.ok(
    allMdSrc.includes("h1_0_semi_product"),
    "{note} block content preserved"
  );
});

// ---------------------------------------------------------------------------
// Source format correctness
// ---------------------------------------------------------------------------

test("source non-last lines end with \\n", () => {
  for (const cell of nb.cells) {
    const src = cell.source;
    for (let i = 0; i < src.length - 1; i++) {
      assert.ok(
        src[i].endsWith("\n"),
        `cell ${cell.id} line ${i} should end with \\n`
      );
    }
  }
});

test("source last line does not end with \\n", () => {
  for (const cell of nb.cells) {
    const src = cell.source;
    if (src.length > 0) {
      assert.ok(
        !src[src.length - 1].endsWith("\n"),
        `cell ${cell.id} last line should not end with \\n`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Output file written
// ---------------------------------------------------------------------------

test("output notebook file written to test/outputs/math.ipynb", () => {
  const written = readFileSync(resolve(__dirname, "outputs/math.ipynb"), "utf8");
  const parsed = JSON.parse(written);
  assert.equal(parsed.nbformat, 4);
  assert.equal(parsed.cells.length, nb.cells.length);
});
