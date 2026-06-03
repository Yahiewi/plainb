import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectFormat, detectPy } from "../src/detect.js";

// ---------------------------------------------------------------------------
// Python scripts
// ---------------------------------------------------------------------------

describe("detectPy", () => {
  test("`# %%` delimiter → percent", () => {
    assert.equal(detectPy("# %%\nx = 1\n# %%\ny = 2"), "percent");
  });

  test("`#%%` without space → percent", () => {
    assert.equal(detectPy("#%%\nx = 1"), "percent");
  });

  test("two 20-hash runs → sphinx-gallery", () => {
    const text = "####################\nx = 1\n####################\ny = 2";
    assert.equal(detectPy(text), "sphinx-gallery");
  });

  test("`# %%` wins over hash runs (percent precedence)", () => {
    const text = "####################\n# %%\nx = 1\n####################";
    assert.equal(detectPy(text), "percent");
  });

  test("leading module docstring, no delimiters → sphinx-gallery", () => {
    assert.equal(detectPy('"""Module doc."""\nimport os\nx = 1'), "sphinx-gallery");
  });

  test("r-prefixed docstring → sphinx-gallery", () => {
    assert.equal(detectPy('r"""\nTitle\n=====\n"""\nx = 1'), "sphinx-gallery");
  });

  test("plain script, no docstring, no delimiters → percent", () => {
    assert.equal(detectPy("import os\nx = 1\nprint(x)"), "percent");
  });

  test("`# %%` inside a docstring is not counted", () => {
    // The only `# %%` lives inside the docstring; file should fall back to the
    // leading-docstring rule → sphinx-gallery, not percent.
    const text = '"""\nExample:\n# %%\n"""\nimport os';
    assert.equal(detectPy(text), "sphinx-gallery");
  });

  test("a single hash run is not enough for sphinx", () => {
    assert.equal(detectPy("####################\nimport os\nx = 1"), "percent");
  });

  test("leading docstring + `# %%` cell separators → sphinx-gallery", () => {
    const text = '"""\nLeading docstring\n"""\n# %%\nx = 1\n# %%\ny = 2';
    assert.equal(detectPy(text), "sphinx-gallery");
  });

  test("leading docstring + `# %% [markdown]` → percent", () => {
    const text = '"""\nLeading docstring\n"""\n# %% [markdown]\n# Some text\n# %%\nx = 1';
    assert.equal(detectPy(text), "percent");
  });
});

// ---------------------------------------------------------------------------
// Extension dispatch
// ---------------------------------------------------------------------------

describe("detectFormat", () => {
  test(".md with {code-cell} → myst", () => {
    assert.equal(detectFormat("```{code-cell}\nx = 1\n```", ".md"), "myst");
  });

  test(".md with +++ → myst", () => {
    assert.equal(detectFormat("First.\n+++\nSecond.", ".md"), "myst");
  });

  test(".md plain prose → classic", () => {
    assert.equal(detectFormat("# Title\n\n```python\nx = 1\n```", ".md"), "classic");
  });

  test("extension without a leading dot is accepted", () => {
    assert.equal(detectFormat("# %%\nx = 1", "py"), "percent");
  });

  test(".py routes to detectPy", () => {
    assert.equal(detectFormat("# %%\nx = 1", ".py"), "percent");
  });
});
