// Unit tests for the checks on top of the model output. Run: npm run test:scoring
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyGuards, mergeBySource, applyYears, splitProblems, yearsFromLines, isCondition } from "./guards.js";

test("employment under a country's law is not a location conflict", () => {
  const a = { location_conflict: true, location_conflict_quote: "Employment under Singapore law.", clarifying_questions: [] };
  applyGuards(a, "Hybrid or remote work format. Employment under Singapore law.");
  assert.equal(a.location_conflict, false);
});

test("mandatory relocation keeps the conflict", () => {
  const a = { location_conflict: true, location_conflict_quote: "Relocation to Berlin is required.", clarifying_questions: [] };
  applyGuards(a, "On-site 4 days a week. Relocation to Berlin is required.");
  assert.equal(a.location_conflict, true);
});

test("quote not in the job post → conflict removed", () => {
  const a = { location_conflict: true, location_conflict_quote: "Must be based in Berlin", clarifying_questions: [] };
  applyGuards(a, "Remote. Employment under Singapore law.");
  assert.equal(a.location_conflict, false);
});

test("preference questions are filtered out", () => {
  const a = { location_conflict: false, clarifying_questions: ["Would you consider Singapore law employment?", "Are you open to relocation?", "How many years of B2B?"] };
  applyGuards(a, "");
  assert.deepEqual(a.clarifying_questions, ["How many years of B2B?"]);
});

const R = (o) => ({ text: "t", source: "", type: "must", hard_gate: false, hard_gate_reason: "", score: "1", evidence: "e", required_years: 0, candidate_years: 0, ...o });

test("split bullet is merged: 1 + 0 → one requirement 0.5", () => {
  const out = mergeBySource([R({ source: "3+ years in B2B, corporate clients", score: "1" }), R({ source: "3+ years in B2B,  corporate clients", score: "0" }), R({ source: "English C1" })]);
  assert.equal(out.length, 2);
  assert.equal(out[0].score, "0.5");
});

test("years: short by 0.5 → max 0.5", () => {
  assert.equal(applyYears(R({ required_years: 4, candidate_years: 3.5 })).score, "0.5");
});

test("years: short by more than 1 → 0 and a hard gate", () => {
  const r = applyYears(R({ required_years: 6, candidate_years: 3, score: "0.5" }));
  assert.equal(r.score, "0");
  assert.equal(r.hard_gate, true);
});

test("years: enough → model score unchanged", () => {
  assert.equal(applyYears(R({ required_years: 3, candidate_years: 4 })).score, "1");
});

test("passed check moves from problems to checks_passed (EN + RU)", () => {
  const a = { problems: [
    "Fluent German required; candidate native, fits",
    "Geography fits: Berlin or remote",
    "No Kubernetes experience",
    "4+ years B2B: candidate has 3.5, not fully covered",
    "Нет опыта с POS-системами",
  ], checks_passed: [] };
  splitProblems(a);
  assert.deepEqual(a.problems, ["No Kubernetes experience", "4+ years B2B: candidate has 3.5, not fully covered", "Нет опыта с POS-системами"]);
  assert.equal(a.checks_passed.length, 2);
});

test("enough years → false rule-2 hard gate removed", () => {
  const r = applyYears(R({ required_years: 4, candidate_years: 5, score: "0.5", hard_gate: true, hard_gate_reason: "Rule 2: requires 4 years, candidate has 3" }));
  assert.equal(r.hard_gate, false);
});

test("years from dates: two non-overlapping periods", () => {
  assert.equal(yearsFromLines(["Product Manager | Acme | Mar 2021 – Aug 2022", "Product Owner | Beta Soft | Mar 2019 – Feb 2021"]), 3.5);
});

test("years from dates: Present and years without months", () => {
  assert.equal(yearsFromLines(["PM, Acme, 2021 – Present"], new Date(2025, 11, 15)), 5);
  assert.equal(yearsFromLines(["PM, Acme Pay, Jan 2021 – Dec 2025"]), 5);
});

test("model miscounted years → code recomputes from dates", () => {
  const r = applyYears(R({ required_years: 4, candidate_years: 2, score: "0", hard_gate: true, hard_gate_reason: "Rule 2", years_evidence: ["Product Manager, Acme Pay (payments app), Jan 2021 – Dec 2025: owned checkout"] }));
  assert.equal(r.candidate_years, 5);
  assert.equal(r.hard_gate, false);
});

test("enough years + rest confirmed → 1; unconfirmed → 0.5", () => {
  const base = { required_years: 3, candidate_years: 2, score: "0", years_evidence: ["PM, Acme, Jan 2021 – Dec 2025"] };
  assert.equal(applyYears(R({ ...base, other_parts_covered: true })).score, "1");
  assert.equal(applyYears(R({ ...base, other_parts_covered: false })).score, "0.5");
});

test("working conditions removed from requirements, visa stays", () => {
  assert.equal(isCondition(R({ text: "Must be based in a US time zone" })), true);
  assert.equal(isCondition(R({ text: "Valid EU work permit required" })), false);
  assert.equal(isCondition(R({ text: "Fluent English" })), false);
  assert.equal(isCondition(R({ text: "Experience with remote teams in Scrum" })), false);
  assert.equal(isCondition(R({ text: "Relocation to Berlin is required" })), true);
  assert.equal(isCondition(R({ text: "Microsoft Office, Jira" })), false);
});
