import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseMystMd } from "../src/parseMystMd.js";
import { toMystMd } from "../src/toMystMd.js";
import { parsePy } from "../src/parsePy.js";
import { toPy } from "../src/toPy.js";
import { parseClassicMd } from "../src/parseClassicMd.js";
import { toClassicMd } from "../src/toClassicMd.js";
import { parseSphinxGallery } from "../src/parseSphinxGallery.js";
import { toSphinxGallery } from "../src/toSphinxGallery.js";
import { makeNotebook, codeCell, markdownCell } from "../src/notebook.js";

const VARIABLES_MYST_SAMPLE = `---
jupytext:
  text_representation:
    extension: .md
    format_name: myst
    format_version: 0.13
kernelspec:
  display_name: C++17
  language: C++17
  name: xcpp17
learning:
  objectives:
    apply: [variable, "d\\xE9claration de variable", affectation]
  prerequisites:
    apply: [valeur, "op\\xE9ration", expression, "expression bool\\xE9enne", type, entier,
      "r\\xE9el", "caract\\xE8re", "bool\\xE9en"]
---

+++ {"nbgrader": {"grade": false, "grade_id": "cell-b78562ee2ff6d72c", "locked": true, "schema_version": 3, "solution": false}}

# TP : variables et affectations

Dans la feuille précédente, nous avons effectué des calculs et observé
les résultats (type, valeur). Pour écrire des programmes, nous aurons
besoin de **stocker les résultats intermédiaires dans des variables**
pour en réutiliser les valeurs.

## Exercice 1

- Exécutez la cellule suivante :

\`\`\`{code-cell}
int a;
a = 3;
\`\`\`

+++ {"nbgrader": {"grade": false, "grade_id": "cell-77b23801c7675aeb", "locked": true, "schema_version": 3, "solution": false}}

Une fois que la variable \`a\` a été ***déclarée*** (\`int a;\`) et qu'on
lui a ***affecté*** une valeur (\`a = 3\`), on peut afficher ou
réutiliser cette valeur :

\`\`\`{code-cell}
---
nbgrader:
  grade: false
  grade_id: cell-cb019a2142f5c180
  locked: true
  schema_version: 3
  solution: false
  task: false
---
a
\`\`\`

\`\`\`{code-cell}
:locked: false

a + 1
\`\`\`
`;

describe("Roundtrip and Idempotency Tests", () => {
  test("02-variables.md is fully idempotent (MyST roundtrip)", () => {
    const nb = parseMystMd(VARIABLES_MYST_SAMPLE);
    const firstWrite = toMystMd(nb);
    const nb2 = parseMystMd(firstWrite);
    const secondWrite = toMystMd(nb2);
    assert.equal(secondWrite, firstWrite);
  });

  test("Percent format roundtrip (with nested cell metadata)", () => {
    const nb = makeNotebook([
      codeCell("a = 1", {
        nbgrader: {
          grade: false,
          grade_id: "cell-cb019a2142f5c180",
          locked: true,
        }
      })
    ]);
    const serialized = toPy(nb);
    const nb2 = parsePy(serialized);
    assert.deepEqual(nb2.cells[0].metadata.nbgrader, nb.cells[0].metadata.nbgrader);
  });

  test("Classic MD roundtrip", () => {
    const nb = makeNotebook([
      markdownCell("# Heading\n\nProse text."),
      codeCell("print('hello')")
    ]);
    const serialized = toClassicMd(nb);
    const nb2 = parseClassicMd(serialized);
    assert.equal(nb2.cells.length, 2);
    assert.equal(nb2.cells[0].cell_type, "markdown");
    assert.equal(nb2.cells[1].cell_type, "code");
  });

  test("Sphinx Gallery roundtrip", () => {
    const nb = makeNotebook([
      markdownCell("Docstring.\n\nDescription."),
      codeCell("x = 1")
    ]);
    const serialized = toSphinxGallery(nb);
    const nb2 = parseSphinxGallery(serialized);
    assert.equal(nb2.cells.length, 2);
  });
});
