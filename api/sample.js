// POST /api/sample — open live demo: no password, fixed fictional input.
// The request body is ignored, so the endpoint cannot be used to run arbitrary prompts.
// Abuse guards: a per-instance hourly limit, a kill switch (SAMPLE_DISABLED=1 in Vercel env)
// and the monthly spend limit on the API account.

import { runAnalysis } from "../lib/analyze.js";
import { SAMPLE_PROFILE, SAMPLE_VACANCY } from "../lib/sample.js";
import { json } from "../lib/http.js";

const LIMIT_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
let windowStart = 0;
let used = 0;

export async function POST() {
  if (process.env.SAMPLE_DISABLED === "1") {
    return json({ error: "The live demo is paused — please check back later" }, 503);
  }
  const now = Date.now();
  if (now - windowStart > HOUR_MS) {
    windowStart = now;
    used = 0;
  }
  if (used >= LIMIT_PER_HOUR) {
    return json({ error: "The live demo is busy — please try again later" }, 429);
  }
  used += 1;
  console.log(JSON.stringify({ event: "sample", used, limit: LIMIT_PER_HOUR }));
  return runAnalysis(SAMPLE_VACANCY, SAMPLE_PROFILE);
}
