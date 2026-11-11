# Golden Set — Vacancy Decoder

How the app's match score is evaluated against a human-made reference. Scoring rules: [BRIEF.md](BRIEF.md) · decisions: [DECISIONS.md](DECISIONS.md).

## Method

- **5 real job posts**, each scored **by hand** with the brief's formula — this is the reference.
- Each post is scored against a real resume, in the version tailored to that role; the resumes are not published.
- The app runs **3 times per post** with the same profile.
- Company names are anonymized; the job post texts are kept locally and not published.

| Test | Pass condition |
|---|---|
| **a. Accuracy** | every run within **±10 points** of the reference |
| **b. Stability** | spread (max − min) across 3 runs **≤ 10 points** |

## The set

Chosen to cover the tricky cases: hard gates, a Russian-language post, a post without nice-to-have requirements, and a wide range of scores.

| # | Case | Lang | Must | Nice | Fit | Open hard gates | Formula | **Reference** |
|---|---|---|---|---|---|---|---|---|
| A | No nice-to-have · hard gate on years | RU | 2.5 / 4 | — | 1 | 1 (years managing a team of PMs) | 71.9% | **40%** (cap) |
| B | Two hard gates (years + mandatory domain) | EN | 4.5 / 7 | 0.5 / 3 | 1 | 2 (years as PM; mandatory domain experience) | 61.9% | **25%** (cap) |
| C | Role outside the candidate's industry · hard gate | EN | 2 / 6 | 1.5 / 2 | 0.5 | 1 (years in the target industry) | 45.0% | **40%** (cap) |
| D | High match · conditions and "preferred" wording | EN | 4 / 4 | 1 / 1 | 0.5 | 0 | 90.0% | **90%** |
| E | Payments · compound nice-to-have bullet | RU | 4.5 / 6 | 0.5 / 1 | 1 | 0 | 75.0% | **75%** |

Formula: `0.6 × must + 0.2 × nice + 0.2 × fit`; without nice-to-have: `(0.6 × must + 0.2 × fit) ÷ 0.8`; one open hard gate caps at 40%, two or more at 25%.

## Labelling decisions

Borderline cases decided once by the labeller and then applied to every post:

- **Soft skills** ("excellent communication", "ownership") are removed from the requirements, not scored 0.
- **Nice-to-have** only with an explicit marker — in D, a degree marked as *preferred* is nice-to-have, while a requirement about working with design teams, with no marker, stays a must.
- **Working conditions** are not requirements — D's time-zone condition is excluded from the score.
- **Years of experience** come from job titles and dates; Product Owner counts as Product Manager. Missing by more than a year → 0 and a hard gate (B, C).
- **Adjacent experience** without explicit evidence → 0 + a clarifying question (A: led teams, but no evidence of managing the specific team type required).
- **One bullet = one requirement**; a partly covered compound bullet → 0.5 (E's nice-to-have).
- **"or related field"** → a related degree counts as 1.
- **Company domain** only from the post text — D never names its industry, so domain fit = 0.

## Results

Final run — effort `medium`, all rules in place (2026-11-11):

| # | Reference | App, 3 runs | Max diff | Spread | a | b |
|---|---|---|---|---|---|---|
| A | 40 | 40 / 37 / 40 | 3 | 3 | ✅ | ✅ |
| B | 25 | 25 / 25 / 25 | 0 | 0 | ✅ | ✅ |
| C | 40 | 40 / 40 / 40 | 0 | 0 | ✅ | ✅ |
| D | 90 | 83 / 83 / 83 | 7 | 0 | ✅ | ✅ |
| E | 75 | 75 / 75 / 75 | 0 | 0 | ✅ | ✅ |

**Accuracy 5 / 5 · Stability 5 / 5.** D sits 7 points below the reference: the model consistently scores the design-teams requirement as 0.5 because the resume uses a broader wording — the labeller chose 1. A clarifying answer in the profile closes the gap.

## How we got there

| Iteration | What changed | Accuracy (a) | Stability (b) |
|---|---|---|---|
| 1. First prompt | — | 2 / 5 | 3 / 5 |
| 2. Prompt fixes | a generic "Requirements" heading is not a *must* marker; conditions are not requirements; years counted per role | 2 / 5 | 4 / 5 |
| 3. Reference fixed + rules agreed | the reference itself had errors (see below); years shortfall > 1 → 0; adjacent experience → 0 + question | 5 / 5 | 5 / 5 (D at the limit: 10) |
| 4. Rules moved into code, effort `low` | years from dates, conditions filter, location conflict only with a quote, merged bullets | 4 / 5 | 4 / 5 (D spread 15) |
| 5. Effort `medium` | — | **5 / 5** | **5 / 5** (max spread 3) |

Cost of the last step: ~$0.003 per analysis instead of ~$0.001, and ~15 s instead of ~5 s.

## Lessons learned

1. **The reference has to be human-verified.** The first, AI-drafted reference had errors: a missing cap, the wrong formula for posts without nice-to-have requirements, soft skills and a time-zone condition counted as requirements, a *preferred* degree treated as a must. Half of the early "model errors" were reference errors.
2. **Agree on borderline rules before measuring.** Most disagreements between the app and the reference were interpretation, not bugs — each needed one explicit decision applied everywhere.
3. **Move rules the model breaks into code.** Prompt instructions held in most runs but not all; deterministic guards made the result repeatable.
4. **Stability costs money.** Higher effort cut the spread from 15 to 3 points at ~2.5× the price — a deliberate trade-off, recorded in [DECISIONS.md](DECISIONS.md).
