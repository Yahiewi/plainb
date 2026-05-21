import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseMd } from "../src/parseMd.js";
import { parseClassicMd } from "../src/parseClassicMd.js";
import { parseMystMd } from "../src/parseMystMd.js";

// ---------------------------------------------------------------------------
// Classic format
// ---------------------------------------------------------------------------

describe("parseClassicMd", () => {
  test("pure markdown → single markdown cell", () => {
    const nb = parseClassicMd("# Hello\n\nSome text.");
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "markdown");
  });

  test("code block with language → code cell", () => {
    const nb = parseClassicMd("Before.\n\n```python\nx = 1\n```\n\nAfter.");
    assert.equal(nb.cells.length, 3);
    assert.equal(nb.cells[0].cell_type, "markdown");
    assert.equal(nb.cells[1].cell_type, "code");
    assert.deepEqual(nb.cells[1].source, ["x = 1"]);
    assert.equal(nb.cells[2].cell_type, "markdown");
  });

  test("untagged fence stays as markdown", () => {
    const nb = parseClassicMd("Text\n\n```\nsome code\n```\n\nMore.");
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "markdown");
  });

  test("code block at start — no empty leading markdown cell", () => {
    const nb = parseClassicMd("```python\nx = 1\n```\n\nAfter.");
    assert.equal(nb.cells[0].cell_type, "code");
  });

  test("code block at end — no empty trailing markdown cell", () => {
    const nb = parseClassicMd("Before.\n\n```python\nx = 1\n```");
    assert.equal(nb.cells.length, 2);
    assert.equal(nb.cells[1].cell_type, "code");
  });

  test("two code blocks with markdown between", () => {
    const nb = parseClassicMd("```python\na=1\n```\n\nMiddle.\n\n```python\nb=2\n```");
    assert.equal(nb.cells.length, 3);
    assert.equal(nb.cells[0].cell_type, "code");
    assert.equal(nb.cells[1].cell_type, "markdown");
    assert.equal(nb.cells[2].cell_type, "code");
  });

  test("empty input → 0 cells", () => {
    const nb = parseClassicMd("");
    assert.equal(nb.cells.length, 0);
  });

  test("whitespace-only input → 0 cells", () => {
    const nb = parseClassicMd("   \n\n  \n");
    assert.equal(nb.cells.length, 0);
  });

  test("longer fence (4 backticks)", () => {
    const nb = parseClassicMd("````python\nx = 1\n````");
    assert.equal(nb.cells[0].cell_type, "code");
  });

  test("code cells have outputs and execution_count", () => {
    const nb = parseClassicMd("```python\nx=1\n```");
    const cell = nb.cells[0] as any;
    assert.deepEqual(cell.outputs, []);
    assert.equal(cell.execution_count, null);
  });

  test("strips and parses notebook frontmatter", () => {
    const kernelspec = { name: "xpython", display_name: "Python 3.13 (XPython)", language: "python" };
    const text = `---\nkernelspec: ${JSON.stringify(kernelspec)}\n---\n# Hello\n\nSome text.`;
    const nb = parseClassicMd(text);
    assert.deepEqual(nb.metadata.kernelspec, kernelspec);
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "markdown");
    assert.ok(!nb.cells[0].source.join("").includes("kernelspec"));
  });
});

// ---------------------------------------------------------------------------
// MyST format
// ---------------------------------------------------------------------------

describe("parseMystMd", () => {
  test("{code-cell} with no options", () => {
    const nb = parseMystMd("```{code-cell} ipython3\nx = 1\n```");
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "code");
    assert.deepEqual(nb.cells[0].source, ["x = 1"]);
  });

  test("prose before directive becomes markdown cell", () => {
    const nb = parseMystMd("# Title\n\nSome text.\n\n```{code-cell}\nx = 1\n```");
    assert.equal(nb.cells.length, 2);
    assert.equal(nb.cells[0].cell_type, "markdown");
    assert.equal(nb.cells[1].cell_type, "code");
  });

  test("{code-cell} with shorthand :tags:", () => {
    const nb = parseMystMd("```{code-cell}\n:tags: [\"hide-input\"]\nx = 1\n```");
    assert.equal(nb.cells[0].cell_type, "code");
    assert.deepEqual(nb.cells[0].metadata.tags, ["hide-input"]);
  });

  test("{code-cell} with YAML front matter", () => {
    const nb = parseMystMd("```{code-cell}\n---\ntags: [\"hide-output\"]\n---\nx = 1\n```");
    assert.equal(nb.cells[0].cell_type, "code");
    assert.deepEqual(nb.cells[0].metadata.tags, ["hide-output"]);
  });

  test("{raw-cell} → raw cell type", () => {
    const nb = parseMystMd("```{raw-cell}\nraw content\n```");
    assert.equal(nb.cells[0].cell_type, "raw");
    const cell = nb.cells[0] as any;
    assert.ok(!("outputs" in cell));
    assert.ok(!("execution_count" in cell));
  });

  test("{markdown-cell} → markdown cell type", () => {
    const nb = parseMystMd("```{markdown-cell}\n# Hello\n```");
    assert.equal(nb.cells[0].cell_type, "markdown");
  });

  test("+++ splits markdown into two cells", () => {
    const nb = parseMystMd("First part.\n+++\nSecond part.");
    assert.equal(nb.cells.length, 2);
    assert.equal(nb.cells[0].cell_type, "markdown");
    assert.equal(nb.cells[1].cell_type, "markdown");
  });

  test('+++ with JSON metadata', () => {
    const nb = parseMystMd('First.\n+++ {"tags": ["foo"]}\nSecond.');
    assert.deepEqual(nb.cells[0].metadata, {});
    assert.deepEqual(nb.cells[1].metadata, { tags: ["foo"] });
  });

  test("notebook YAML front matter parsed into notebook metadata", () => {
    const nb = parseMystMd("---\nkernelspec: python3\n---\n# Hello");
    assert.equal(nb.metadata.kernelspec, "python3");
  });

  test("nested JSON object in front matter parsed back to object, not string", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const input = `---\nkernelspec: ${JSON.stringify(kernelspec)}\n---\n# Hello`;
    const nb = parseMystMd(input);
    assert.deepEqual(nb.metadata.kernelspec, kernelspec);
  });

  test("multiple nested metadata objects parsed correctly", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const language_info = { name: "python", version: "3.11" };
    const input = `---\nkernelspec: ${JSON.stringify(kernelspec)}\nlanguage_info: ${JSON.stringify(language_info)}\n---\n# Hello`;
    const nb = parseMystMd(input);
    assert.deepEqual(nb.metadata.kernelspec, kernelspec);
    assert.deepEqual(nb.metadata.language_info, language_info);
  });

  test("no spurious empty markdown cell between two directives", () => {
    const nb = parseMystMd("```{code-cell}\na=1\n```\n```{code-cell}\nb=2\n```");
    assert.equal(nb.cells.length, 2);
    assert.equal(nb.cells[0].cell_type, "code");
    assert.equal(nb.cells[1].cell_type, "code");
  });

  test("{math} block directive converted to $$ display math", () => {
    const nb = parseMystMd(
      "Some text.\n\n```{math}\n\\mathcal{M} := \\{u(\\mu)\\}\n```\n\nMore text."
    );
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "markdown");
    const src = nb.cells[0].source.join("");
    assert.ok(!src.includes("```{math}"), "raw directive removed");
    assert.ok(src.includes("$$"), "$$ wrapper present");
    assert.ok(src.includes("\\mathcal{M}"), "math content preserved");
  });

  test("inline {math}` role converted to $...$", () => {
    const nb = parseMystMd("The value {math}`d_N(\\mathcal{M})` is small.");
    const src = nb.cells[0].source.join("");
    assert.ok(!src.includes("{math}`"), "role syntax removed");
    assert.ok(src.includes("$d_N(\\mathcal{M})$"), "inline math present");
  });

  test("{meth}` with ~ shortening → last segment only", () => {
    const nb = parseMystMd("Call {meth}`~pymor.models.Model.solve` now.");
    const src = nb.cells[0].source.join("");
    assert.ok(!src.includes("{meth}"), "role removed");
    assert.ok(src.includes("solve"), "last segment kept");
    assert.ok(!src.includes("pymor"), "dotted prefix stripped");
  });

  test("{meth}` with label <target> → label only", () => {
    const nb = parseMystMd("See {meth}`solutions <pymor.models.Model.solve>`.");
    const src = nb.cells[0].source.join("");
    assert.ok(src.includes("solutions"), "label kept");
    assert.ok(!src.includes("pymor"), "target stripped");
  });

  test("{cite}` removed entirely", () => {
    const nb = parseMystMd("As shown {cite}`BCDDPW11`, {cite}`DPW13` there.");
    const src = nb.cells[0].source.join("");
    assert.ok(!src.includes("{cite}"), "cite role removed");
    assert.ok(!src.includes("BCDDPW11"), "cite label removed");
  });

  test("{{ var }} substitutions → plain name", () => {
    const nb = parseMystMd("Use {{ NumPy }} and {{ VectorArrays }} here.");
    const src = nb.cells[0].source.join("");
    assert.ok(!src.includes("{{"), "braces removed");
    assert.ok(src.includes("NumPy"), "name kept");
    assert.ok(src.includes("VectorArrays"), "name kept");
  });

  test("unknown directives don't swallow surrounding content", () => {
    const nb = parseMystMd(
      "Before.\n\n```{try_on_binder}\n```\n\n```{code-cell}\nx = 1\n```"
    );
    // markdown cell (Before + try_on_binder block) + code cell
    assert.equal(nb.cells.length, 2);
    assert.equal(nb.cells[0].cell_type, "markdown");
    assert.equal(nb.cells[1].cell_type, "code");
  });

  test("empty input → 0 cells", () => {
    const nb = parseMystMd("");
    assert.equal(nb.cells.length, 0);
  });

  test("all cell ids unique", () => {
    const nb = parseMystMd("```{code-cell}\na=1\n```\n```{code-cell}\nb=2\n```\n```{code-cell}\nc=3\n```");
    const ids = nb.cells.map((c) => c.id);
    assert.equal(ids.length, new Set(ids).size);
  });
});

// ---------------------------------------------------------------------------
// Auto-detection dispatcher
// ---------------------------------------------------------------------------

describe("parseMd (dispatcher)", () => {
  test("MyST input routes to MyST parser", () => {
    const nb = parseMd("```{code-cell} ipython3\nx = 1\n```");
    assert.equal(nb.cells[0].cell_type, "code");
  });

  test("classic input routes to classic parser", () => {
    const nb = parseMd("# Title\n\n```python\nx = 1\n```");
    assert.equal(nb.cells.length, 2);
  });

  test("+++ routes to MyST parser", () => {
    const nb = parseMd("First.\n+++\nSecond.");
    assert.equal(nb.cells.length, 2);
  });

  test("plain prose routes to classic", () => {
    const nb = parseMd("Just some text.");
    assert.equal(nb.cells.length, 1);
    assert.equal(nb.cells[0].cell_type, "markdown");
  });

  test("output is valid nbformat 4 object", () => {
    const nb = parseMd("```python\nx=1\n```");
    assert.equal(nb.nbformat, 4);
    assert.equal(nb.nbformat_minor, 5);
    assert.ok(Array.isArray(nb.cells));
    assert.ok("metadata" in nb);
  });
});
