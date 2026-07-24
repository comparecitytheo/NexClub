import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

// Thrown when AI features are used without configuration; routes map this to a 400.
export class AiError extends Error {}

export function isAiConfigured(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

// Model is configurable; defaults to a current general-purpose Claude model.
const MODEL = env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new AiError("AI features are not configured. Set ANTHROPIC_API_KEY.");
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

// Pull the concatenated text out of a Messages API response.
function extractText(content: Array<{ type: string }>): string {
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runClaude(opts: { system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return extractText(message.content);
}

// Ask for strict JSON and parse it defensively (handles stray prose or code fences).
export async function runClaudeJSON<T>(opts: { system: string; prompt: string; maxTokens?: number }): Promise<T> {
  const raw = await runClaude({
    ...opts,
    system: `${opts.system}\n\nRespond with ONLY valid JSON — no markdown, no code fences, no commentary.`,
  });
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    return JSON.parse(slice) as T;
  } catch {
    throw new AiError("The AI response could not be parsed. Please try again.");
  }
}
