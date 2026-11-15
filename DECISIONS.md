# Decision log — Vacancy Decoder

Key product and technical decisions, in order. The current specification is in [BRIEF.md](BRIEF.md); eval results are in [GOLDEN_SET.md](GOLDEN_SET.md).

| Date | Decision | Why |
|---|---|---|
| 2026-11-08 | LLM labels requirements, code computes the score | Same labels must always give the same %; the formula has to be testable without the model |
| 2026-11-08 | Hard-gate caps (40% / 25%) instead of a plain weighted average | A missing mandatory requirement should block the verdict, not just lower it slightly |
| 2026-11-09 | Soft skills excluded everywhere, including must-haves | Not verifiable from a resume; scoring them made results subjective and unstable |
| 2026-11-09 | Nice-to-have only with an explicit marker (*preferred, plus, nice to have*) | Judging "soft" wording was inconsistent and would empty the must-have list |
| 2026-11-10 | One bullet = one requirement; "or related field" counts as 1 | The hand-labelled reference and the model must share the same denominator |
| 2026-11-10 | Function = actual experience from the resume, not target roles | Target roles made the score depend on wishes rather than evidence |
| 2026-11-10 | Years from titles and dates; PO = PM; short by > 1 year → 0 and a hard gate | Summary claims inflated experience; partial credit hid real blockers |
| 2026-11-10 | Adjacent experience → 0 + clarifying question | The user may have the experience but not have written it down |
| 2026-11-10 | Company domain from the post text only | The model's outside knowledge about companies is unreliable |
| 2026-11-10 | Location conflict counts as a hard gate; other conditions stay out of the % | "Can I work there at all" is a blocker; salary and format are preferences |
| 2026-11-11 | Daily summary at 18:00 replaced by on-demand insights (3/day) | A fixed time missed users whose page was closed; on demand is simpler and cheaper |
| 2026-11-11 | English UI, verdict next to the score | International audience; the verdict is readable in one second |
| 2026-11-11 | "Target roles" field removed | It no longer affected the score after the function rule change |
| 2026-11-11 | Rules moved into code: years from dates, conditions filter, location conflict only with a verbatim quote, split bullets merged, preference questions filtered | The model broke these rules in a share of runs; code applies them every time |
| 2026-11-11 | Effort `low` → `medium`, max_tokens 4,000 → 10,000 | Low swung up to 15 points between runs; medium keeps the spread ≤ 3 points at ~2.5× the cost (~$0.003 per analysis, ~15 s) |
| 2026-11-12 | Open live demo: "Try a sample" works without a password via `/api/sample`; everything else stays behind the password | Visitors from a resume link should see the product in one click; the endpoint takes fixed fictional input on the server, so it cannot run arbitrary prompts, and is capped at 20 calls/hour per instance with a kill switch (`SAMPLE_DISABLED=1`) |
