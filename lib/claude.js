// Shared Claude API wrapper: settings from BRIEF.md → Constraints
// and error-handling rules.

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";
export const EFFORT = process.env.VD_EFFORT || "medium";
export const MAX_TOKENS = 10000;
export const MAX_TOKENS_RETRY = 16000;

export const MESSAGES = {
  truncated: "Something went wrong, please try again",
  overloaded: "The service is busy, please try again later",
  generic: "Something went wrong, please try again later",
};

// The client reads the key from the ANTHROPIC_API_KEY environment variable.
// The SDK retries up to 2 times on 429 / 5xx.
const client = new Anthropic();

export class UserFacingError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * One call with a JSON-schema response.
 * Truncated response (stop_reason: max_tokens) → one automatic retry with 16000.
 */
export async function callClaudeJson({ system, user, schema }) {
  let lastStop;
  for (const maxTokens of [MAX_TOKENS, MAX_TOKENS_RETRY]) {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        output_config: {
          effort: EFFORT,
          format: { type: "json_schema", schema },
        },
        system,
        messages: [{ role: "user", content: user }],
      });
    } catch (error) {
      throw toUserFacingError(error);
    }

    logUsage(response, maxTokens);
    lastStop = response.stop_reason;

    if (response.stop_reason === "max_tokens") continue; // → retry with a higher limit
    if (response.stop_reason !== "end_turn") break; // refusal etc.

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    try {
      return JSON.parse(text);
    } catch {
      throw new UserFacingError(MESSAGES.truncated, 502);
    }
  }

  throw new UserFacingError(lastStop === "max_tokens" ? MESSAGES.truncated : MESSAGES.generic, 502);
}

function toUserFacingError(error) {
  console.error("Claude API error:", error?.status, error?.message);
  const overloaded =
    error instanceof Anthropic.RateLimitError || error?.status === 529 || error?.type === "overloaded_error";
  if (overloaded) return new UserFacingError(MESSAGES.overloaded, 503);
  return new UserFacingError(MESSAGES.generic, 500);
}

// Metrics go to server logs (Vercel → Logs). No personal data is logged.
function logUsage(response, maxTokens) {
  const { input_tokens, output_tokens } = response.usage;
  const cost = (input_tokens / 1e6) * 0.1 + (output_tokens / 1e6) * 0.5;
  console.log(
    `[claude] stop=${response.stop_reason} max_tokens=${maxTokens} in=${input_tokens} out=${output_tokens} cost=$${cost.toFixed(6)}`,
  );
}
