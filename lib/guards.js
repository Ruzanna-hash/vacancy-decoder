// ---------- Deterministic checks on top of the model output ----------
// The model sometimes flags a location conflict based on the employer's country / contract
// ("employment under Singapore law") or asks preference questions.
// Code filters these out so the score does not jump between runs.

const LOCATION_WORDS =
  /based|on-?site|office|relocat|time ?zone|located|resid|must (?:live|be) in|офис|релокац|переезд|находиться|часов\w* пояс|проживан/i;
const PREFERENCE_QUESTION =
  /would you (?:consider|accept|be open)|are you (?:open|willing|able) to|open to (?:relocat|work)|готов[аы]? ли|рассматриваете ли|would you relocate/i;

const normalize = (t) => t.toLowerCase().replace(/\s+/g, " ").trim();

const SCORE_NUM = { "1": 1, "0.5": 0.5, "0": 0 };

// One bullet = one requirement: parts the model split up
// are merged back. All parts 1 → 1, all 0 → 0, otherwise 0.5.
export function mergeBySource(requirements) {
  const groups = new Map();
  for (const r of requirements) {
    const key = normalize(r.source || r.text);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((parts) => {
    if (parts.length === 1) return parts[0];
    const values = parts.map((p) => SCORE_NUM[p.score] ?? 0);
    const score = values.every((v) => v === 1) ? "1" : values.every((v) => v === 0) ? "0" : "0.5";
    return {
      ...parts[0],
      text: parts.map((p) => p.text).join(" + "),
      hard_gate: parts.some((p) => p.hard_gate),
      hard_gate_reason: parts.map((p) => p.hard_gate_reason).filter(Boolean).join("; "),
      score,
      evidence: score === "0" ? "" : parts.map((p) => p.evidence).filter(Boolean).join(" … "),
      required_years: Math.max(...parts.map((p) => p.required_years || 0)),
      candidate_years: Math.max(...parts.map((p) => p.candidate_years || 0)),
    };
  });
}

// Code computes years from dates; the model only picks the resume lines with job titles.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  янв: 0, фев: 1, мар: 2, апр: 3, май: 4, мая: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };
const POINT = "(?:([A-Za-zА-Яа-я]{3})[a-zа-я]*\\.?\\s+)?((?:19|20)\\d{2})";
const RANGE = new RegExp(`${POINT}\\s*[–—-]\\s*(?:${POINT}|(present|now|current|по н\\.?в\\.?|настоящее время|сейчас))`, "i");

function toMonth(mon, year, isEnd) {
  const m = mon ? MONTHS[mon.toLowerCase().slice(0, 3)] : undefined;
  return Number(year) * 12 + (m ?? (isEnd ? 11 : 0));
}

export function yearsFromLines(lines, now = new Date()) {
  const ranges = [];
  for (const line of lines ?? []) {
    const m = String(line).match(RANGE);
    if (!m) continue;
    const start = toMonth(m[1], m[2], false);
    const end = m[5] ? now.getFullYear() * 12 + now.getMonth() : toMonth(m[3], m[4], true);
    if (end >= start) ranges.push([start, end + 1]);
  }
  if (!ranges.length) return null;
  ranges.sort((a, b) => a[0] - b[0]);
  let months = 0, [cs, ce] = ranges[0];
  for (const [s, e] of ranges.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else { months += ce - cs; [cs, ce] = [s, e]; }
  }
  months += ce - cs;
  return Math.round((months / 12) * 2) / 2;
}

// Years are scored by code: short by > 1 year → 0 and a hard gate; ≤ 1 year → at most 0.5.
export function applyYears(r, notes = "") {
  const need = Number(r.required_years) || 0;
  if (need <= 0) return r;
  // If the user stated their years in resume additions, trust the model (it takes the number from there);
  // otherwise recompute years from the dates in the selected resume lines.
  const fromDates = /стаж|years? (?:of|in|as)|experience:\s*\d/i.test(notes) ? null : yearsFromLines(r.years_evidence);
  if (fromDates !== null) r = { ...r, candidate_years: fromDates };
  const gap = need - (Number(r.candidate_years) || 0);
  // Code sets the score: enough years and the rest confirmed → 1;
  // enough years but the rest unconfirmed, or short by ≤ 1 year → 0.5; otherwise 0.
  if (typeof r.other_parts_covered === "boolean" && gap <= 1) {
    const score = gap <= 0 && r.other_parts_covered ? "1" : "0.5";
    const clear = r.hard_gate && /rule\s*2/i.test(r.hard_gate_reason) ? { hard_gate: false, hard_gate_reason: "" } : {};
    return { ...r, ...clear, score };
  }
  if (gap > 1) return { ...r, score: "0", hard_gate: true, evidence: "", hard_gate_reason: r.hard_gate_reason || `rule 2: needs ${need}y, candidate ${r.candidate_years}y` };
  // Enough years (or short by ≤ 1 year) → no years hard gate.
  const clearGate = r.hard_gate && /rule\s*2/i.test(r.hard_gate_reason) ? { hard_gate: false, hard_gate_reason: "" } : {};
  if (gap > 0 && r.score === "1") return { ...r, ...clearGate, score: "0.5" };
  return { ...r, ...clearGate };
}

// A "gap" that is actually a passed check ("Fluent German required; candidate native, fits").
const PASSED = /\b(?:fits|fit|meets|matches|satisf(?:ied|ies)|covered|ok|no issue|no conflict)\b|соответству|подходит|закрыт[ао]?\b|нет конфликта/i;
const NEGATION = /\b(?:not|no|doesn['’]t|does not|isn['’]t|lacks?|missing|unclear|unknown|partial(?:ly)?|but)\b|\bне\b|нет\s(?!конфликта)|частично|неизвест/i;

export function splitProblems(analysis) {
  const keep = [];
  const passed = [...(analysis.checks_passed ?? [])];
  for (const p of analysis.problems ?? []) {
    if (PASSED.test(p) && !NEGATION.test(p)) passed.push(p);
    else keep.push(p);
  }
  analysis.problems = keep;
  analysis.checks_passed = passed;
}

// Working conditions are not requirements (brief): remove them if the model extracted them anyway.
// Visa / citizenship / work permit are requirements and stay.
const CONDITION = /\b(?:based in|time ?zone|on-?site|in[- ]office|relocat\w*|salary|work format|must (?:live|be located) in)\b|часов\w* пояс|релокац|зарплат|находиться в/i;
const AUTHORIZATION = /visa|citizen|work (?:permit|authori[sz]ation)|right to work|виз|гражданств|разрешени\w* на работу/i;
export const isCondition = (r) => {
  const t = `${r.text} ${r.source ?? ""}`;
  return CONDITION.test(t) && !AUTHORIZATION.test(t);
};

export function applyGuards(analysis, vacancy, notes = "") {
  analysis.requirements = mergeBySource((analysis.requirements ?? []).filter((r) => !isCondition(r))).map((r) => applyYears(r, notes));
  if (analysis.location_conflict) {
    const quote = normalize(analysis.location_conflict_quote ?? "");
    const valid = quote.length > 0 && normalize(vacancy).includes(quote) && LOCATION_WORDS.test(quote);
    if (!valid) {
      analysis.location_conflict = false;
      analysis.location_conflict_reason = "";
    }
  }
  analysis.clarifying_questions = (analysis.clarifying_questions ?? []).filter((q) => !PREFERENCE_QUESTION.test(q));
  splitProblems(analysis);
}
