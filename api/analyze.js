// POST /api/analyze — analyze one job post against the user's profile (password required).
// Prompt, schema and scoring live in lib/analyze.js.

import { runAnalysis } from "../lib/analyze.js";
import {
  FIELD_MAX_CHARS,
  RESUME_MAX_CHARS,
  VACANCY_MAX_CHARS,
  checkPassword,
  json,
  readJson,
  str,
} from "../lib/http.js";

export async function POST(request) {
  if (!checkPassword(request)) return json({ error: "Wrong password" }, 401);

  const body = await readJson(request);
  if (!body) return json({ error: "Something went wrong, please try again later" }, 400);

  const vacancy = typeof body.vacancy === "string" ? body.vacancy.trim() : "";
  if (!vacancy) return json({ error: "Paste the job post text" }, 400);
  if (vacancy.length > VACANCY_MAX_CHARS) {
    return json({ error: "The text is too long — shorten it to 8,000 characters" }, 400);
  }

  const p = body.profile ?? {};
  const profile = {
    resume: str(p.resume, RESUME_MAX_CHARS),
    geography: str(p.geography, FIELD_MAX_CHARS),
    domains: str(p.domains, FIELD_MAX_CHARS),
    redFlags: str(p.redFlags, FIELD_MAX_CHARS),
    notes: str(p.notes, RESUME_MAX_CHARS),
  };
  if (!profile.resume) return json({ error: "Add your resume to the profile first" }, 400);

  return runAnalysis(vacancy, profile);
}
