import { useState, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { parsePy, parseClassicMd, parseMystMd, parseSphinxGallery } from 'plainb'

// ---------------------------------------------------------------------------
// Sample inputs
// ---------------------------------------------------------------------------

const PY_SAMPLE = `# ---
# kernelspec: {"display_name": "Python 3", "name": "python3"}
# language_info: {"name": "python"}
# ---
#
# %% [markdown]
# # My Notebook
# Welcome to **plainb** — a lightweight text-to-notebook converter.

# %%
import numpy as np

x = np.linspace(0, 2 * np.pi, 100)
y = np.sin(x)

# %% [markdown]
# ## Results
# The plot below shows $y = \\sin(x)$.

# %% tags='["hide-input"]'
import matplotlib.pyplot as plt

plt.plot(x, y)
plt.title("Sine wave")
plt.show()
`

const MD_SAMPLE = `---
kernelspec: {"display_name": "Python 3", "name": "python3"}
language_info: {"name": "python"}
---

# My Notebook

Welcome to **plainb** — a lightweight text-to-notebook converter.

\`\`\`python
import numpy as np

x = np.linspace(0, 2 * np.pi, 100)
y = np.sin(x)
\`\`\`

## Results

The plot below shows $y = \\sin(x)$.

\`\`\`python
import matplotlib.pyplot as plt

plt.plot(x, y)
plt.title("Sine wave")
plt.show()
\`\`\`
`

const MYST_SAMPLE = `---
kernelspec: {"display_name": "Python 3", "name": "python3"}
language_info: {"name": "python"}
---

# My Notebook

Welcome to **plainb** — a lightweight text-to-notebook converter.

\`\`\`{code-cell} ipython3
import numpy as np

x = np.linspace(0, 2 * np.pi, 100)
y = np.sin(x)
\`\`\`

## Results

The plot below shows $y = \\sin(x)$.

\`\`\`{code-cell} ipython3
:tags: ["hide-input"]
import matplotlib.pyplot as plt

plt.plot(x, y)
plt.title("Sine wave")
plt.show()
\`\`\`
`

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
`

const SG_SAMPLE = `# ---
# kernelspec: {"display_name": "Python 3", "name": "python3"}
# language_info: {"name": "python"}
# ---
"""
==============================
Probability Calibration curves
==============================

Demonstrates how to visualize calibration curves (reliability diagrams)
and calibrate an uncalibrated classifier.

"""

# Authors: The scikit-learn developers
# SPDX-License-Identifier: BSD-3-Clause

# %%
# Dataset
# -------
#
# We will use a synthetic binary classification dataset with 100,000 samples
# and 20 features. Of the 20 features, only 2 are informative, 10 are
# redundant (random combinations of the informative features) and the
# remaining 8 are uninformative (random numbers).

from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split

X, y = make_classification(
    n_samples=100_000, n_features=20, n_informative=2, n_redundant=10, random_state=42
)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.99, random_state=42)

# %%
# Calibration curves
# ------------------
#
# Gaussian Naive Bayes
# ^^^^^^^^^^^^^^^^^^^^
#
# We compare :class:\`~sklearn.linear_model.LogisticRegression\` (baseline),
# uncalibrated :class:\`~sklearn.naive_bayes.GaussianNB\`, and GaussianNB
# with isotonic and sigmoid calibration
# (see :ref:\`User Guide <calibration>\`).

import matplotlib.pyplot as plt
from sklearn.calibration import CalibratedClassifierCV, CalibrationDisplay
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import GaussianNB

lr = LogisticRegression(C=1.0)
gnb = GaussianNB()
gnb_isotonic = CalibratedClassifierCV(gnb, cv=2, method="isotonic")
gnb_sigmoid = CalibratedClassifierCV(gnb, cv=2, method="sigmoid")

# %%
fig, ax = plt.subplots(figsize=(8, 6))
for clf, name in [(lr, "Logistic"), (gnb, "Naive Bayes"),
                  (gnb_isotonic, "NB + Isotonic"), (gnb_sigmoid, "NB + Sigmoid")]:
    clf.fit(X_train, y_train)
    CalibrationDisplay.from_estimator(clf, X_test, y_test, n_bins=10, name=name, ax=ax)
ax.set_title("Calibration plots (Naive Bayes)")
plt.tight_layout()
plt.show()

# %%
# Summary
# -------
#
# Parametric sigmoid calibration handles sigmoid-shaped calibration curves
# (e.g., :class:\`~sklearn.svm.LinearSVC\`) but not transposed-sigmoid curves
# (e.g., :class:\`~sklearn.naive_bayes.GaussianNB\`). Non-parametric isotonic
# calibration handles both but may require more data.
`

const INPUT_LANGUAGE: Record<Format, string> = {
  py: 'python',
  md: 'markdown',
  myst: 'markdown',
  myst_vars: 'markdown',
  sg: 'python',
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

type Format = 'py' | 'md' | 'myst' | 'myst_vars' | 'sg'

const SAMPLES: Record<Format, string> = {
  py: PY_SAMPLE,
  md: MD_SAMPLE,
  myst: MYST_SAMPLE,
  myst_vars: VARIABLES_MYST_SAMPLE,
  sg: SG_SAMPLE
}

const LABELS: Record<Format, string> = {
  py: '.py percent',
  md: '.md classic',
  myst: '.md MyST (simple)',
  myst_vars: '.md MyST (variables)',
  sg: 'sphinx-gallery'
}

export default function App() {
  const [format, setFormat] = useState<Format>('py')
  const [input, setInput] = useState(PY_SAMPLE)
  const [dark, setDark] = useState(false)

  const monacoTheme = dark ? 'vs-dark' : 'vs'

  function toggleTheme() {
    setDark(d => {
      document.documentElement.setAttribute('data-theme', d ? 'light' : 'dark')
      return !d
    })
  }

  function switchFormat(f: Format) {
    setFormat(f)
    setInput(SAMPLES[f])
  }

  const { json, error } = useMemo(() => {
    try {
      const nb = format === 'py'   ? parsePy(input)
               : format === 'sg'   ? parseSphinxGallery(input)
               : format === 'myst' ? parseMystMd(input)
               :                     parseClassicMd(input)
      return { json: JSON.stringify(nb, null, 2), error: null }
    } catch (e) {
      return { json: '', error: String(e) }
    }
  }, [input, format])

  function download() {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'notebook.ipynb'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="toolbar">
        <h1>plainb</h1>
        <span className="sep" />
        <div className="format-tabs">
          {(Object.keys(LABELS) as Format[]).map(f => (
            <button
              key={f}
              className={format === f ? 'active' : ''}
              onClick={() => switchFormat(f)}
            >
              {LABELS[f]}
            </button>
          ))}
        </div>
        <button className="theme-btn" onClick={toggleTheme}>{dark ? '☀ Light' : '☾ Dark'}</button>
        <button className="download-btn" onClick={download} disabled={!!error}>
          ↓ Download .ipynb
        </button>
      </div>

      <div className="panels">
        <div className="panel">
          <div className="panel-header">Input</div>
          <div className="editor-wrap">
            <Editor
              value={input}
              language={INPUT_LANGUAGE[format]}
              theme={monacoTheme}
              onChange={v => setInput(v ?? '')}
              options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on' }}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">nbformat 4 JSON</div>
          {error
            ? <div className="error-banner">{error}</div>
            : <div className="editor-wrap">
                <Editor
                  value={json}
                  language="json"
                  theme={monacoTheme}
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
                />
              </div>
          }
        </div>
      </div>
    </>
  )
}
