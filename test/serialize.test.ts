import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toPy } from "../src/toPy.js";
import { toClassicMd } from "../src/toClassicMd.js";
import { toMystMd } from "../src/toMystMd.js";
import { toSphinxGallery } from "../src/toSphinxGallery.js";
import { serialize } from "../src/index.js";
import { parsePy } from "../src/parsePy.js";
import { parseClassicMd } from "../src/parseClassicMd.js";
import { parseMystMd } from "../src/parseMystMd.js";
import { parseSphinxGallery } from "../src/parseSphinxGallery.js";
import { makeNotebook, codeCell, markdownCell, rawCell } from "../src/notebook.js";
import { filterMetadata } from "../src/utils.js";

// ---------------------------------------------------------------------------
// toMystMd
// ---------------------------------------------------------------------------

describe("toMystMd", () => {
  test("single markdown cell → plain text", () => {
    const nb = makeNotebook([markdownCell("# Hello\n\nSome text.")]);
    const out = toMystMd(nb);
    assert.ok(out.includes("# Hello"));
    assert.ok(!out.includes("+++"));
  });

  test("two markdown cells → +++ separator", () => {
    const nb = makeNotebook([markdownCell("First."), markdownCell("Second.")]);
    const out = toMystMd(nb);
    assert.ok(out.includes("+++"));
    assert.ok(out.includes("First."));
    assert.ok(out.includes("Second."));
  });

  test("code cell → {code-cell} directive", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    const out = toMystMd(nb);
    assert.ok(out.includes("```{code-cell}"));
    assert.ok(out.includes("x = 1"));
    assert.ok(out.includes("```"));
  });

  test("raw cell → {raw-cell} directive", () => {
    const nb = makeNotebook([rawCell("raw content")]);
    const out = toMystMd(nb);
    assert.ok(out.includes("```{raw-cell}"));
    assert.ok(out.includes("raw content"));
  });

  test("code cell with tags metadata → shorthand options", () => {
    const nb = makeNotebook([codeCell("x = 1", { tags: ["hide-input"] })]);
    const out = toMystMd(nb);
    assert.ok(out.includes(":tags:"));
    assert.ok(out.includes("hide-input"));
  });

  test("markdown cell with metadata → +++ {json}", () => {
    const nb = makeNotebook([markdownCell("Content.", { tags: ["foo"] })]);
    const out = toMystMd(nb);
    assert.ok(out.includes('+++ {"tags": ["foo"]}'));
  });

  test("notebook metadata → YAML front matter", () => {
    const nb = makeNotebook([markdownCell("Hi.")], { kernelspec: "python3" });
    const out = toMystMd(nb);
    assert.ok(out.startsWith("---\n"));
    assert.ok(out.includes("kernelspec: python3"));
    assert.ok(out.includes("---"));
  });

  test("nested object metadata serialized as YAML", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec });
    const out = toMystMd(nb);
    assert.ok(out.includes("kernelspec:"), "kernelspec key must be present");
    assert.ok(out.includes("name: python3"), "name must be present under kernelspec");
  });

  test("ends with newline", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.ok(toMystMd(nb).endsWith("\n"));
  });

  // Round-trip tests
  test("round-trip: markdown cell preserved", () => {
    const nb = makeNotebook([markdownCell("# Title\n\nSome text.")]);
    const nb2 = parseMystMd(toMystMd(nb));
    assert.equal(nb2.cells.length, 1);
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[0].source.join(""), "# Title\n\nSome text.");
  });

  test("round-trip: code cell preserved", () => {
    const nb = makeNotebook([codeCell("x = 1\nprint(x)")]);
    const nb2 = parseMystMd(toMystMd(nb));
    assert.equal(nb2.cells[0].cell_type, "code");
    assert.equal(nb2.cells[0].source.join(""), "x = 1\nprint(x)");
  });

  test("round-trip: code cell with tags preserved", () => {
    const nb = makeNotebook([codeCell("x = 1", { tags: ["hide-input"] })]);
    const nb2 = parseMystMd(toMystMd(nb));
    assert.deepEqual(nb2.cells[0].metadata.tags, ["hide-input"]);
  });

  test("round-trip: markdown cell with metadata preserved", () => {
    const nb = makeNotebook([markdownCell("Content.", { tags: ["foo"] })]);
    const nb2 = parseMystMd(toMystMd(nb));
    assert.deepEqual(nb2.cells[0].metadata, { tags: ["foo"] });
  });

  test("round-trip: mixed cells preserved", () => {
    const nb = makeNotebook([
      markdownCell("# Title"),
      codeCell("x = 1"),
      markdownCell("Some text."),
      codeCell("print(x)"),
    ]);
    const nb2 = parseMystMd(toMystMd(nb));
    assert.equal(nb2.cells.length, 4);
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[1].cell_type, "code");
    assert.equal(nb2.cells[2].cell_type, "markdown");
    assert.equal(nb2.cells[3].cell_type, "code");
  });

  test("round-trip: notebook metadata preserved", () => {
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec: "python3" });
    const nb2 = parseMystMd(toMystMd(nb));
    assert.equal(nb2.metadata.kernelspec, "python3");
  });

  test("round-trip: nested object metadata roundtrips correctly", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const language_info = { name: "python", version: "3.11" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec, language_info });
    const nb2 = parseMystMd(toMystMd(nb));
    assert.deepEqual(nb2.metadata.kernelspec, kernelspec);
    assert.deepEqual(nb2.metadata.language_info, language_info);
  });

  test("round-trip: complex nested cell metadata in YAML block", () => {
    const nb = makeNotebook([
      codeCell("a", {
        nbgrader: {
          grade: false,
          grade_id: "cell-cb019a2142f5c180",
          locked: true,
          schema_version: 3,
          solution: false,
          task: false
        }
      })
    ]);
    const serialized = toMystMd(nb);
    assert.ok(serialized.includes("---"));
    assert.ok(serialized.includes("nbgrader:"));
    const nb2 = parseMystMd(serialized);
    assert.deepEqual(nb2.cells[0].metadata.nbgrader, nb.cells[0].metadata.nbgrader);
  });

  test("cleanCellMetadata strips transient keys but preserves nbgrader and locked in toMystMd", () => {
    const nb = makeNotebook([
      codeCell("a", {
        trusted: true,
        collapsed: false,
        locked: true,
        nbgrader: { grade: false }
      })
    ]);
    const serialized = toMystMd(nb);
    assert.ok(!serialized.includes("trusted"), "trusted must be stripped");
    assert.ok(!serialized.includes("collapsed"), "collapsed must be stripped");
    assert.ok(serialized.includes("locked"), "locked must be preserved");
    assert.ok(serialized.includes("nbgrader"), "nbgrader must be preserved");
  });


  test("empty notebook → just a newline", () => {
    const nb = makeNotebook([]);
    assert.equal(toMystMd(nb), "\n");
  });
});

// ---------------------------------------------------------------------------
// toPy
// ---------------------------------------------------------------------------

describe("toPy", () => {
  test("code cell → # %% delimiter + bare source", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    const out = toPy(nb);
    assert.ok(out.includes("# %%"));
    assert.ok(out.includes("x = 1"));
    assert.ok(!out.includes("# x = 1"));
  });

  test("markdown cell → # %% [markdown] + commented lines", () => {
    const nb = makeNotebook([markdownCell("# Title\n\nSome text.")]);
    const out = toPy(nb);
    assert.ok(out.includes("# %% [markdown]"));
    assert.ok(out.includes("# # Title"));
    assert.ok(out.includes("#"));
    assert.ok(out.includes("# Some text."));
  });

  test("raw cell → # %% [raw] + commented lines", () => {
    const nb = makeNotebook([rawCell("raw content")]);
    const out = toPy(nb);
    assert.ok(out.includes("# %% [raw]"));
    assert.ok(out.includes("# raw content"));
  });

  test("cell name in metadata → encoded in delimiter", () => {
    const nb = makeNotebook([codeCell("x = 1", { name: "my cell" })]);
    const out = toPy(nb);
    assert.ok(out.includes("# %% my cell"));
  });

  test("tags in metadata → encoded in delimiter", () => {
    const nb = makeNotebook([codeCell("x = 1", { tags: ["hide-input"] })]);
    const out = toPy(nb);
    assert.ok(out.includes("tags="));
    assert.ok(out.includes("hide-input"));
  });

  test("ends with newline", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.ok(toPy(nb).endsWith("\n"));
  });

  test("notebook metadata → commented YAML front matter", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec });
    const out = toPy(nb);
    assert.ok(out.startsWith("# ---\n"), "must start with # ---");
    assert.ok(out.includes("# jupyter:"), "must contain commented jupyter namespace key");
    assert.ok(out.includes("kernelspec:"), "must contain kernelspec key");
    assert.ok(out.includes("python3"), "kernelspec name must be present");
  });

  test("round-trip: nested metadata preserved through toPy/parsePy", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec });
    const nb2 = parsePy(toPy(nb));
    assert.deepEqual(nb2.metadata.kernelspec, kernelspec);
  });

  test("no metadata → no front matter block emitted", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    const out = toPy(nb);
    assert.ok(!out.startsWith("# ---"), "no front matter for empty metadata");
  });

  // Round-trip tests
  test("round-trip: code cell preserved", () => {
    const nb = makeNotebook([codeCell("x = 1\nprint(x)")]);
    const nb2 = parsePy(toPy(nb));
    assert.equal(nb2.cells[0].cell_type, "code");
    assert.equal(nb2.cells[0].source.join(""), "x = 1\nprint(x)");
  });

  test("round-trip: markdown cell preserved", () => {
    const nb = makeNotebook([markdownCell("# Title\n\nSome text.")]);
    const nb2 = parsePy(toPy(nb));
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[0].source.join(""), "# Title\n\nSome text.");
  });

  test("round-trip: cell name preserved", () => {
    const nb = makeNotebook([codeCell("x = 1", { name: "my cell" })]);
    const nb2 = parsePy(toPy(nb));
    assert.equal(nb2.cells[0].metadata.name, "my cell");
  });

  test("round-trip: tags preserved", () => {
    const nb = makeNotebook([codeCell("x = 1", { tags: ["hide-input"] })]);
    const nb2 = parsePy(toPy(nb));
    assert.deepEqual(nb2.cells[0].metadata.tags, ["hide-input"]);
  });

  test("round-trip: mixed cells preserved", () => {
    const nb = makeNotebook([
      markdownCell("# Title"),
      codeCell("x = 1"),
      markdownCell("Middle."),
      codeCell("print(x)"),
    ]);
    const nb2 = parsePy(toPy(nb));
    assert.equal(nb2.cells.length, 4);
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[1].cell_type, "code");
    assert.equal(nb2.cells[2].cell_type, "markdown");
    assert.equal(nb2.cells[3].cell_type, "code");
  });

  test("round-trip: complex nested cell metadata in Percent format", () => {
    const nb = makeNotebook([
      codeCell("a", {
        nbgrader: {
          grade: false,
          grade_id: "cell-cb019a2142f5c180",
          locked: true,
        }
      }),
      codeCell("b", {
        tags: ["hide-input"],
        name: "cell-name"
      })
    ]);
    const serialized = toPy(nb);
    const nb2 = parsePy(serialized);
    assert.deepEqual(nb2.cells[0].metadata.nbgrader, nb.cells[0].metadata.nbgrader);
    assert.deepEqual(nb2.cells[1].metadata.tags, ["hide-input"]);
    assert.deepEqual(nb2.cells[1].metadata.name, "cell-name");
  });

  test("cleanCellMetadata strips transient keys but preserves nbgrader and tags in toPy", () => {
    const nb = makeNotebook([
      codeCell("a", {
        trusted: true,
        collapsed: false,
        tags: ["tag1"],
        nbgrader: { grade: false }
      })
    ]);
    const serialized = toPy(nb);
    assert.ok(!serialized.includes("trusted"), "trusted must be stripped");
    assert.ok(!serialized.includes("collapsed"), "collapsed must be stripped");
    assert.ok(serialized.includes("tags"), "tags must be preserved");
    assert.ok(serialized.includes("nbgrader"), "nbgrader must be preserved");
  });

});

// ---------------------------------------------------------------------------
// toClassicMd
// ---------------------------------------------------------------------------

describe("toClassicMd", () => {
  test("markdown cell → raw text", () => {
    const nb = makeNotebook([markdownCell("# Hello\n\nSome text.")]);
    const out = toClassicMd(nb);
    assert.ok(out.includes("# Hello"));
    assert.ok(!out.includes("```"));
  });

  test("code cell → fenced python block", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    const out = toClassicMd(nb);
    assert.ok(out.includes("```python\nx = 1\n```"));
  });

  test("custom language parameter", () => {
    const nb = makeNotebook([codeCell("let x = 1")]);
    const out = toClassicMd(nb, "javascript");
    assert.ok(out.includes("```javascript"));
  });

  test("raw cells are omitted", () => {
    const nb = makeNotebook([rawCell("raw content")]);
    const out = toClassicMd(nb);
    assert.equal(out.trim(), "");
  });

  test("ends with newline", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.ok(toClassicMd(nb).endsWith("\n"));
  });

  // Round-trip tests
  test("round-trip: markdown cell preserved", () => {
    const nb = makeNotebook([markdownCell("# Title\n\nSome text.")]);
    const nb2 = parseClassicMd(toClassicMd(nb));
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[0].source.join(""), "# Title\n\nSome text.");
  });

  test("round-trip: code cell preserved", () => {
    const nb = makeNotebook([codeCell("x = 1\nprint(x)")]);
    const nb2 = parseClassicMd(toClassicMd(nb));
    assert.equal(nb2.cells[0].cell_type, "code");
    assert.equal(nb2.cells[0].source.join(""), "x = 1\nprint(x)");
  });

  test("round-trip: mixed cells preserved", () => {
    const nb = makeNotebook([markdownCell("Intro."), codeCell("x = 1"), markdownCell("Outro.")]);
    const nb2 = parseClassicMd(toClassicMd(nb));
    assert.equal(nb2.cells.length, 3);
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[1].cell_type, "code");
    assert.equal(nb2.cells[2].cell_type, "markdown");
  });

  test("notebook metadata → YAML front matter", () => {
    const kernelspec = { name: "xpython", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec });
    const out = toClassicMd(nb);
    assert.ok(out.startsWith("---\n"));
    assert.ok(out.includes("kernelspec:"));
    assert.ok(out.includes("xpython"));
  });

  test("round-trip: notebook metadata preserved", () => {
    const kernelspec = { name: "xpython", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([codeCell("x = 1")], { kernelspec });
    const nb2 = parseClassicMd(toClassicMd(nb));
    assert.deepEqual(nb2.metadata.kernelspec, kernelspec);
  });
});

// ---------------------------------------------------------------------------
// toSphinxGallery
// ---------------------------------------------------------------------------

describe("toSphinxGallery", () => {
  test("first markdown cell → triple-quoted docstring", () => {
    const nb = makeNotebook([markdownCell("Title\n\nDescription.")]);
    const out = toSphinxGallery(nb);
    assert.ok(out.startsWith('"""'));
    assert.ok(out.includes("Title"));
    assert.ok(out.includes('"""'));
  });

  test("code cell → # %% section with bare source", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    const out = toSphinxGallery(nb);
    assert.ok(out.includes("# %%"));
    assert.ok(out.includes("x = 1"));
    assert.ok(!out.includes("# x = 1"));
  });

  test("markdown cell after first → # %% with commented lines", () => {
    const nb = makeNotebook([codeCell("x = 1"), markdownCell("Some comment.")]);
    const out = toSphinxGallery(nb);
    assert.ok(out.includes("# Some comment."));
  });

  test("adjacent [markdown, code] merged into one section", () => {
    const nb = makeNotebook([markdownCell("Docstring."), markdownCell("Section."), codeCell("x=1")]);
    const out = toSphinxGallery(nb);
    // Should have exactly one # %% section containing both comment and code
    const sections = out.split("# %%").length - 1;
    assert.equal(sections, 1);
    assert.ok(out.includes("# Section."));
    assert.ok(out.includes("x=1"));
  });

  test("raw cells are omitted", () => {
    const nb = makeNotebook([rawCell("raw"), codeCell("x = 1")]);
    const out = toSphinxGallery(nb);
    assert.ok(!out.includes("raw"));
  });

  test("ends with newline", () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.ok(toSphinxGallery(nb).endsWith("\n"));
  });

  test("notebook metadata → commented YAML front matter before docstring", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([markdownCell("Docs."), codeCell("x = 1")], { kernelspec });
    const out = toSphinxGallery(nb);
    assert.ok(out.startsWith("# ---\n"), "must start with # ---");
    assert.ok(out.includes("# jupyter:"), "must contain commented jupyter namespace key");
    assert.ok(out.includes("kernelspec:"), "must contain kernelspec key");
  });

  test("round-trip: nested metadata preserved through toSphinxGallery/parseSphinxGallery", () => {
    const kernelspec = { name: "python3", display_name: "Python 3", language: "python" };
    const nb = makeNotebook([markdownCell("Docs."), codeCell("x = 1")], { kernelspec });
    const nb2 = parseSphinxGallery(toSphinxGallery(nb));
    assert.deepEqual(nb2.metadata.kernelspec, kernelspec);
  });

  // Round-trip tests
  test("round-trip: docstring markdown cell preserved", () => {
    const nb = makeNotebook([markdownCell("Title\n\nDescription."), codeCell("x = 1")]);
    const nb2 = parseSphinxGallery(toSphinxGallery(nb));
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[0].source.join(""), "Title\n\nDescription.");
  });

  test("round-trip: code cell after docstring preserved", () => {
    const nb = makeNotebook([markdownCell("Docs."), codeCell("x = 1\nprint(x)")]);
    const nb2 = parseSphinxGallery(toSphinxGallery(nb));
    const codeC = nb2.cells.find((c) => c.cell_type === "code");
    assert.ok(codeC);
    assert.equal(codeC.source.join(""), "x = 1\nprint(x)");
  });

  test("round-trip: [markdown, code] section preserved", () => {
    const nb = makeNotebook([
      markdownCell("Docstring."),
      markdownCell("Section heading."),
      codeCell("import numpy as np"),
    ]);
    const nb2 = parseSphinxGallery(toSphinxGallery(nb));
    assert.equal(nb2.cells.length, 3);
  });
});

// ---------------------------------------------------------------------------
// serialize() unified dispatcher
// ---------------------------------------------------------------------------

describe("serialize", () => {
  test('"py" dispatches to toPy', () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.equal(serialize(nb, "py"), toPy(nb));
  });

  test('"md" dispatches to toMystMd', () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.equal(serialize(nb, "md"), toMystMd(nb));
  });

  test('"sphinx-gallery" dispatches to toSphinxGallery', () => {
    const nb = makeNotebook([codeCell("x = 1")]);
    assert.equal(serialize(nb, "sphinx-gallery"), toSphinxGallery(nb));
  });

  test("unknown format throws", () => {
    const nb = makeNotebook([]);
    assert.throws(() => serialize(nb, "unknown" as never), /Unknown format/);
  });

  test("parse/serialize round-trip: py", () => {
    const src = "# %%\nx = 1\n\n# %% [markdown]\n# # Title\n";
    const nb = parsePy(src);
    const nb2 = parsePy(serialize(nb, "py"));
    assert.equal(nb2.cells.length, nb.cells.length);
    assert.equal(nb2.cells[0].source.join(""), nb.cells[0].source.join(""));
  });

  test("parse/serialize round-trip: md (MyST)", () => {
    const src = "# Title\n\n```{code-cell}\nx = 1\n```\n";
    const nb = parseMystMd(src);
    const nb2 = parseMystMd(serialize(nb, "md"));
    assert.equal(nb2.cells.length, nb.cells.length);
  });

  test("parse/serialize round-trip: sphinx-gallery", () => {
    const src = '"""\nDocs.\n"""\n\n# %%\n# Comment\n\nx = 1\n';
    const nb = parseSphinxGallery(src);
    const nb2 = parseSphinxGallery(serialize(nb, "sphinx-gallery"));
    assert.equal(nb2.cells.length, nb.cells.length);
  });
});

describe("filterMetadata & serialization options", () => {
  test("filters metadata with simple inclusions", () => {
    const meta = { a: 1, b: 2, c: 3 };
    const filtered = filterMetadata(meta, "a,b");
    assert.deepEqual(filtered, { a: 1, b: 2 });
  });

  test("filters metadata with simple exclusions", () => {
    const meta = { a: 1, b: 2, c: 3 };
    const filtered = filterMetadata(meta, "-b");
    assert.deepEqual(filtered, { a: 1, c: 3 });
  });

  test("filters metadata with 'all'", () => {
    const meta = { a: 1, b: 2, c: 3 };
    const filtered = filterMetadata(meta, "all,-b");
    assert.deepEqual(filtered, { a: 1, c: 3 });
  });

  test("filters metadata with 'none'", () => {
    const meta = { a: 1, b: 2, c: 3 };
    const filtered = filterMetadata(meta, "none,a");
    assert.deepEqual(filtered, { a: 1 });
  });

  test("filters metadata with nested dot paths", () => {
    const meta = {
      kernelspec: { name: "python3", display_name: "Python 3" },
      jupytext: { text_representation: { version: "1.0", format: "percent" } },
      other: 42
    };

    // Keep all, but exclude specific nested keys
    const filtered1 = filterMetadata(meta, "all,-jupytext.text_representation.version,-other");
    assert.deepEqual(filtered1, {
      kernelspec: { name: "python3", display_name: "Python 3" },
      jupytext: { text_representation: { format: "percent" } }
    });

    // Exclude all, but include specific nested keys
    const filtered2 = filterMetadata(meta, "kernelspec.name,jupytext.text_representation");
    assert.deepEqual(filtered2, {
      kernelspec: { name: "python3" },
      jupytext: { text_representation: { version: "1.0", format: "percent" } }
    });
  });

  test("integration: custom filters applied in toMystMd and toPy", () => {
    const nb = makeNotebook(
      [codeCell("x = 1", { tag: "value", trusted: true })],
      { kernelspec: { name: "python3" }, language_info: { name: "python" } }
    );

    // Default myst md serialization (no options) should keep all notebook metadata and clean certain cell metadata
    const mystDefault = toMystMd(nb);
    assert.ok(mystDefault.includes("kernelspec:"));
    assert.ok(mystDefault.includes("language_info:"));
    assert.ok(!mystDefault.includes("trusted"));

    // Myst MD serialization with filters
    const mystFiltered = toMystMd(nb, {
      notebookMetadataFilter: "kernelspec",
      cellMetadataFilter: "all,-tag"
    });
    assert.ok(mystFiltered.includes("kernelspec:"));
    assert.ok(!mystFiltered.includes("language_info:"));
    assert.ok(mystFiltered.includes("trusted: true"));
    assert.ok(!mystFiltered.includes("tag:"));

    // Py percent format serialization with filters
    const pyFiltered = toPy(nb, {
      notebookMetadataFilter: "language_info",
      cellMetadataFilter: "tag"
    });
    assert.ok(!pyFiltered.includes("kernelspec:"));
    assert.ok(pyFiltered.includes("language_info:"));
    assert.ok(!pyFiltered.includes("trusted: true"));
    assert.ok(pyFiltered.includes("tag="));
  });
});
