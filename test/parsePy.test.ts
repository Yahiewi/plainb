import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePy } from "../src/parsePy.js";

test("no delimiter → single code cell", () => {
  const nb = parsePy("x = 1\nprint(x)\n");
  assert.equal(nb.cells.length, 1);
  assert.equal(nb.cells[0].cell_type, "code");
  assert.deepEqual(nb.cells[0].source, ["x = 1\n", "print(x)"]);
});

test("empty input → 0 cells", () => {
  const nb = parsePy("");
  assert.equal(nb.cells.length, 0);
});

test("two code cells", () => {
  const nb = parsePy("# %%\nx = 1\n# %%\ny = 2\n");
  assert.equal(nb.cells.length, 2);
  assert.equal(nb.cells[0].cell_type, "code");
  assert.equal(nb.cells[1].cell_type, "code");
});

test("markdown cell with line-comment content", () => {
  const nb = parsePy("# %%\ncode()\n# %% [markdown]\n# # Title\n# Some text\n");
  assert.equal(nb.cells.length, 2);
  const md = nb.cells[1];
  assert.equal(md.cell_type, "markdown");
  assert.deepEqual(md.source, ["# Title\n", "Some text"]);
});

test("[md] alias for markdown", () => {
  const nb = parsePy("# %% [md]\n# hello\n");
  assert.equal(nb.cells[0].cell_type, "markdown");
});

test("raw cell", () => {
  const nb = parsePy("# %% [raw]\n# raw content\n");
  assert.equal(nb.cells[0].cell_type, "raw");
  assert.deepEqual(nb.cells[0].source, ["raw content"]);
});

test("markdown cell with triple-quote content", () => {
  const nb = parsePy('# %% [markdown]\n"""\n# Title\nSome text\n"""\n');
  const md = nb.cells[0];
  assert.equal(md.cell_type, "markdown");
  assert.deepEqual(md.source, ["# Title\n", "Some text"]);
});

test("cell title stored in metadata.name", () => {
  const nb = parsePy("# %% My Analysis\nx = 1\n");
  assert.equal(nb.cells[0].metadata.name, "My Analysis");
});

test("tags parsed from kv metadata", () => {
  const nb = parsePy("# %% [markdown] tags='[\"hide-input\"]'\n# text\n");
  assert.deepEqual(nb.cells[0].metadata.tags, ["hide-input"]);
});

test("empty markdown cell still emitted", () => {
  const nb = parsePy("# %% [markdown]\n# %%\nx = 1\n");
  // Empty markdown cell + code cell
  assert.equal(nb.cells.length, 2);
  assert.equal(nb.cells[0].cell_type, "markdown");
  assert.equal(nb.cells[1].cell_type, "code");
});

test("trailing blank lines stripped from code cell", () => {
  const nb = parsePy("# %%\nx = 1\n\n\n# %%\ny = 2\n");
  assert.equal(nb.cells[0].source[nb.cells[0].source.length - 1], "x = 1");
});

test("CRLF normalized", () => {
  const nb = parsePy("# %%\r\nx = 1\r\n# %% [markdown]\r\n# hi\r\n");
  assert.equal(nb.cells.length, 2);
  assert.equal(nb.cells[0].cell_type, "code");
  assert.equal(nb.cells[1].cell_type, "markdown");
});

test("nbformat fields correct", () => {
  const nb = parsePy("# %%\nx = 1\n");
  assert.equal(nb.nbformat, 4);
  assert.equal(nb.nbformat_minor, 5);
  assert.ok("metadata" in nb);
});

test("all cell ids unique", () => {
  const nb = parsePy("# %%\na=1\n# %%\nb=2\n# %%\nc=3\n");
  const ids = nb.cells.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("code cells have outputs and execution_count", () => {
  const nb = parsePy("# %%\nx = 1\n");
  const cell = nb.cells[0] as any;
  assert.deepEqual(cell.outputs, []);
  assert.equal(cell.execution_count, null);
});

test("markdown cells have no outputs or execution_count", () => {
  const nb = parsePy("# %% [markdown]\n# hi\n");
  const cell = nb.cells[0] as any;
  assert.ok(!("outputs" in cell));
  assert.ok(!("execution_count" in cell));
});

test("source last line has no trailing newline", () => {
  const nb = parsePy("# %%\nx = 1\ny = 2\n");
  const src = nb.cells[0].source;
  assert.ok(!src[src.length - 1].endsWith("\n"));
});

test("source non-last lines end with newline", () => {
  const nb = parsePy("# %%\nx = 1\ny = 2\n");
  const src = nb.cells[0].source;
  assert.ok(src[0].endsWith("\n"));
});

// ---------------------------------------------------------------------------
// Front-matter metadata
// ---------------------------------------------------------------------------

test("# --- front matter block parsed into notebook metadata", () => {
  const input = "# ---\n# title: My Notebook\n# ---\n\n# %%\nx = 1\n";
  const nb = parsePy(input);
  assert.equal(nb.metadata.title, "My Notebook");
});

test("nested JSON in front matter parsed back to object", () => {
  const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
  const input = `# ---\n# kernelspec: ${JSON.stringify(kernelspec)}\n# ---\n\n# %%\nx = 1\n`;
  const nb = parsePy(input);
  assert.deepEqual(nb.metadata.kernelspec, kernelspec);
});

test("front matter does not appear as a cell", () => {
  const input = "# ---\n# title: My Notebook\n# ---\n\n# %%\nx = 1\n";
  const nb = parsePy(input);
  assert.equal(nb.cells.length, 1);
  assert.equal(nb.cells[0].cell_type, "code");
});

test("no front matter → empty metadata", () => {
  const nb = parsePy("# %%\nx = 1\n");
  assert.deepEqual(nb.metadata, {});
});

test("no-delimiter file with front matter → metadata set, single code cell", () => {
  const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
  const input = `# ---\n# kernelspec: ${JSON.stringify(kernelspec)}\n# ---\nx = 1\n`;
  const nb = parsePy(input);
  assert.deepEqual(nb.metadata.kernelspec, kernelspec);
  assert.equal(nb.cells.length, 1);
  assert.equal(nb.cells[0].cell_type, "code");
});
