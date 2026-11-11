// Shared helpers for API functions: password, JSON responses, input limits.

import { createHash, timingSafeEqual } from "node:crypto";
import { MESSAGES, UserFacingError } from "./claude.js";

export const VACANCY_MAX_CHARS = 8000;
export const RESUME_MAX_CHARS = 15000; // budget guard
export const FIELD_MAX_CHARS = 1000;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// The password lives in the APP_PASSWORD environment variable, not in code.
export function checkPassword(request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    console.error("APP_PASSWORD is not set");
    return false;
  }
  const given = request.headers.get("x-app-password") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function str(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function handleError(error) {
  if (error instanceof UserFacingError) return json({ error: error.message }, error.status);
  console.error("Unexpected error:", error);
  return json({ error: MESSAGES.generic }, 500);
}
