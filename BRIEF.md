# Product Brief — Vacancy Decoder

Current product specification. How and why it got here: [DECISIONS.md](DECISIONS.md).

## Problem

Job seekers spend 10–15 minutes per job post deciding whether to apply: reading long descriptions, separating hard requirements from wishes, checking them against their own experience. The assessment is subjective and inconsistent, and after a day of applications there is no clear picture of *why* most posts were a poor fit.

## Target user

A job seeker who screens many job posts a day and wants a fast, evidence-based answer to "should I apply, and what am I missing?"

## User flow

1. **Set up a profile once:** paste a resume, add location preferences, a list of own domains (e.g. fintech, payments) and red flags (e.g. office only).
2. **Paste a job post** and get the analysis.
3. **Answer clarifying questions** inline; answers are saved as *resume additions* and the score is recalculated.
4. **Request insights** for the day's analyses when needed.

The profile and today's history are stored only in the user's browser.

## What the AI returns

- **Company brief:** company name and domain, taken from the job post text only.
- **Match score (%)** with a verdict: *Worth applying* (≥ 70) · *Think it over* (40–69) · *Skip* (< 40 or an open hard gate).
- **Requirements breakdown:** each requirement typed as must / nice-to-have and scored 1 / 0.5 / 0 with a verbatim resume quote as evidence.
- **Gaps:** missing requirements and tools, location conflicts, red flags the post explicitly states.
- **What fits:** checks that passed.
- **Clarifying questions** when the resume lacks facts needed for a fair score — no guessing.
- **Insights (on demand):** across today's analyses, the one pattern that lowered scores most plus one recommendation (≤ 2 sentences).

The analysis is written in the language of the job post and should be readable in 30 seconds.

## Match scoring

| Component | Weight | How it is scored |
|---|---|---|
| Must-have requirements | 60% | share covered: fully 1, partially 0.5, not 0 |
| Nice-to-have requirements | 20% | same scale |
| Function & domain fit | 20% | 1 — both match, 0.5 — one of two, 0 — neither |
| Cap | — | one open hard gate → max 40%; two or more → max 25% |

**No nice-to-have in the post:** the weight is redistributed — `(0.6 × must + 0.2 × fit) ÷ 0.8`.
**No identifiable must-haves:** no score; the user sees "No explicit requirements in this job post — the score would be unreliable".

### Who computes what

The LLM extracts and labels requirements; **code** computes the percentage, caps and verdict. Rules the model applied inconsistently were moved into code as deterministic guards (see [DECISIONS.md](DECISIONS.md)).

### Scoring rules

- **Function** = what the person actually did according to the resume (job titles and responsibilities). Seniority (Junior / Senior / Lead / Head) is ignored. Product Owner counts as Product Manager.
- **Domain** = the user's own list; the company's domain is taken from the job post text only, never from the model's outside knowledge.
- **Hard gate** — a requirement scored 0 that is:
  1. explicitly marked *must / required / mandatory* (or the Russian equivalents) in the bullet or in a section title that says so — a generic "Requirements" heading does not count;
  2. a years-of-experience requirement the user misses by **more than 1 year**;
  3. a language, citizenship or visa requirement listed as mandatory.
- **Years of experience** are counted from job titles and dates in the resume (not from summary claims), for the role named in the requirement. Qualifiers such as "in B2B" or a domain affect only 1 vs 0.5, not the number of years. Enough years → 1; short by ≤ 1 year → 0.5; short by more → 0 and a hard gate. The code parses the dates.
- **1 vs 0.5:** 1 only if the quote covers every part of the requirement (role, domain, client type, tool); otherwise 0.5.
- **One bullet = one requirement.** A compound bullet is not split; if only part of it is covered → 0.5.
- **"…or related field":** a related degree or experience counts as 1; a sub-discipline of a broad field (e.g. Finance within Business) counts as that field.
- **Adjacent but not explicit experience** (e.g. leading teams vs. managing a team of PMs) → 0 + a clarifying question.
- **Unknown facts** (visa, language, location not in the resume) → 0 + a clarifying question.
- **Soft skills** are never extracted or scored — they cannot be verified from a resume.
- **Implicit seniority** (senior / lead / head in the title, no explicit years) → listed in Gaps, does not affect the score.
- **Working conditions** (location, time zone, salary, contract type) are not requirements and do not affect the score — except a **location conflict**: if the post makes a location / time zone / relocation mandatory and the user's profile explicitly states a location that does not fit, it counts as an open hard gate (cap applies). Unknown user location → a gap and a clarifying question, no cap.

## Insights

- Requested by the user (button), hidden until then and collapsible.
- Covers all job posts analyzed today (browser history, calendar day).
- Limit: 3 requests per day.

## Interface

- English UI; the analysis itself is in the job post's language.
- Score delta ("Changes") when the same job post is analyzed again, with the list of changed requirements and new resume additions.
- A live sample with a fictional candidate, a privacy note, an AI disclaimer and a "Delete my data" action.

## Constraints

| Parameter | Value |
|---|---|
| Model | `claude-haiku-5-5` |
| Effort | `medium` |
| max_tokens | 10,000 (retry with 16,000 if truncated) |
| Job post length | up to 8,000 characters (≈ 2 pages); longer input is blocked with a message |
| Function timeout | 60 s on the server, 75 s in the browser |

**Error handling**

- Truncated response → automatic retry with a higher limit; if it fails again: "Something went wrong, please try again".
- Rate limit / overloaded → "The service is busy, please try again later".
- Any other error → "Something went wrong, please try again later".

## Access & budget

- **Open demo:** anyone with the link can run *Try a sample* — a live analysis of a fictional candidate. The server uses only its own fixed input; limit 20 runs per hour per server instance; can be switched off with `SAMPLE_DISABLED=1`.
- **Full access** (own profile, Analyze, Insights): a shared password given to interviewers / testers, checked on the server; the password and the API key live in environment variables, never in code.
- Limits per user per day: 50 analyses, 3 insights (counted in the browser).
- The real budget guard is a $10/month spend limit on the API account.

## Out of scope

- Tailoring the resume or writing cover letters.
- Market-level assessment or a standalone resume review — the product only evaluates the user against a specific job post.

## Acceptance criteria

Each criterion is a pass / fail test.

| # | Test | Pass condition |
|---|---|---|
| a | Golden set | 5 real job posts scored by hand with the formula; the app is within ±10 points on each |
| b | Stability | Same job post, 3 runs in a row; spread (max − min) ≤ 10 points |
| c | Language | EN post → EN analysis; RU post → RU analysis |
| d | Hard gate | One open hard gate → score ≤ 40% (two or more → ≤ 25%) |
| e | No must-haves | No identifiable requirements → message, no score |

Results: see [GOLDEN_SET.md](GOLDEN_SET.md) — tests a and b pass 5 / 5 on effort medium.
