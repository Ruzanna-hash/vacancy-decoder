// Unit tests for the match formula. Run: npm run test:scoring
// No model calls — the tests are free and deterministic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatch } from "./scoring.js";

const req = (type, score, hard_gate = false) => ({ type, score, hard_gate });

test("no must-haves → no score", () => {
  const r = computeMatch({ requirements: [req("nice", "1")], function_match: true, domain_match: true });
  assert.equal(r.noMust, true);
});

test("everything covered → 100%", () => {
  const r = computeMatch({
    requirements: [req("must", "1"), req("nice", "1")],
    function_match: true,
    domain_match: true,
  });
  assert.equal(r.match, 100);
});

test("weights 60/20/20", () => {
  // must: (1 + 0) / 2 = 0.5 → 30; nice: 0.5 → 10; fit: 0.5 → 10; total 50
  const r = computeMatch({
    requirements: [req("must", "1"), req("must", "0"), req("nice", "0.5")],
    function_match: true,
    domain_match: false,
  });
  assert.equal(r.match, 50);
});

test("one open hard gate → max 40%", () => {
  const r = computeMatch({
    requirements: [req("must", "1"), req("must", "1"), req("must", "1"), req("must", "0", true), req("nice", "1")],
    function_match: true,
    domain_match: true,
  });
  assert.equal(r.raw, 85);
  assert.equal(r.match, 40);
  assert.equal(r.openGates, 1);
});

test("two open hard gates → max 25%", () => {
  const r = computeMatch({
    requirements: [req("must", "1"), req("must", "0", true), req("must", "0", true), req("nice", "1")],
    function_match: true,
    domain_match: true,
  });
  assert.equal(r.match, 25);
});

test("hard gate partly covered (0.5) → no cap", () => {
  const r = computeMatch({
    requirements: [req("must", "0.5", true), req("nice", "1")],
    function_match: true,
    domain_match: true,
  });
  assert.equal(r.cap, null);
  assert.equal(r.match, 70);
});

test("no nice-to-have → weight redistributed to must and fit", () => {
  // must 1 → 0.6, fit 0 → 0; (0.6 + 0) / 0.8 = 75%
  const r = computeMatch({ requirements: [req("must", "1")], function_match: false, domain_match: false });
  assert.equal(r.match, 75);
});

test("location conflict → cap 40%, not counted in must", () => {
  const r = computeMatch({
    requirements: [req("must", "1"), req("nice", "1")],
    function_match: true,
    domain_match: true,
    location_conflict: true,
  });
  assert.equal(r.raw, 100);
  assert.equal(r.match, 40);
  assert.equal(r.openGates, 1);
});

test("location conflict + open hard gate → 25%", () => {
  const r = computeMatch({
    requirements: [req("must", "1"), req("must", "0", true), req("nice", "1")],
    function_match: true,
    domain_match: true,
    location_conflict: true,
  });
  assert.equal(r.match, 25);
});
