// POST /api/auth — password check on sign-in.

import { checkPassword, json } from "../lib/http.js";

export async function POST(request) {
  if (!checkPassword(request)) return json({ error: "Wrong password" }, 401);
  return json({ ok: true });
}
