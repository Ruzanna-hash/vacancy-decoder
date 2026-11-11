// Match formula from BRIEF.md → "Match scoring".
// The model only labels requirements; this code computes the percentage,
// so the same labels always give the same result.

export const WEIGHTS = { must: 0.6, nice: 0.2, fit: 0.2 };
export const CAP_ONE_GATE = 40;
export const CAP_TWO_GATES = 25;

const SCORE_VALUES = { "1": 1, "0.5": 0.5, "0": 0 };

export function scoreValue(score) {
  return SCORE_VALUES[String(score)] ?? 0;
}

function average(items) {
  return items.reduce((sum, r) => sum + scoreValue(r.score), 0) / items.length;
}

/**
 * @param {object} analysis - labels from the model
 * @param {Array<{type:"must"|"nice", hard_gate:boolean, score:"1"|"0.5"|"0"}>} analysis.requirements
 * @param {boolean} analysis.function_match
 * @param {boolean} analysis.domain_match
 * @param {boolean} [analysis.location_conflict] - the post requires a location that explicitly conflicts with the profile
 * @returns {{noMust: true} | {noMust: false, match: number, raw: number, cap: number|null, openGates: number, parts: object}}
 */
export function computeMatch(analysis) {
  const requirements = analysis.requirements ?? [];
  const must = requirements.filter((r) => r.type === "must");
  const nice = requirements.filter((r) => r.type === "nice");

  // Brief rule: no explicit must-haves → no score.
  if (must.length === 0) return { noMust: true };

  const mustPart = average(must);
  const fitPart =
    ((analysis.function_match ? 1 : 0) + (analysis.domain_match ? 1 : 0)) / 2;

  let raw;
  let nicePart = null;
  if (nice.length > 0) {
    nicePart = average(nice);
    raw = WEIGHTS.must * mustPart + WEIGHTS.nice * nicePart + WEIGHTS.fit * fitPart;
  } else {
    // No nice-to-have requirements → their 20% is split
    // proportionally between must and fit (75% / 25%).
    raw = (WEIGHTS.must * mustPart + WEIGHTS.fit * fitPart) / (WEIGHTS.must + WEIGHTS.fit);
  }

  // An open hard gate = score 0. Partial coverage (0.5) does not trigger the cap.
  // Working conditions (location / time zone / remote region) are not scored,
  // but an explicit conflict with the profile location counts as one more open hard gate.
  const openGates =
    requirements.filter((r) => r.hard_gate && scoreValue(r.score) === 0).length +
    (analysis.location_conflict ? 1 : 0);
  const cap = openGates >= 2 ? CAP_TWO_GATES : openGates === 1 ? CAP_ONE_GATE : null;

  const rawPercent = Math.round(raw * 100);
  const match = cap === null ? rawPercent : Math.min(rawPercent, cap);

  return {
    noMust: false,
    match,
    raw: rawPercent,
    cap,
    openGates,
    parts: {
      must: Math.round(mustPart * 100),
      nice: nicePart === null ? null : Math.round(nicePart * 100),
      fit: Math.round(fitPart * 100),
    },
  };
}
