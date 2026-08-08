import { NextResponse } from "next/server";
import { requireUserForWrite } from "@/server/api-helpers";
import { isAiConfigured, runClaude, AiError } from "@/server/ai";
import { buildEntityContext } from "@/server/ai-context";
import { aiEntitySchema } from "@/server/validators/ai";

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  if (!isAiConfigured()) return NextResponse.json({ error: "AI features are not configured." }, { status: 400 });

  const parsed = aiEntitySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { entityType, entityId } = parsed.data;

  const ctx = await buildEntityContext(user, entityType, entityId);
  if (!ctx) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  try {
    const summary = await runClaude({
      system:
        "You are a CRM assistant for an Australian finance brokerage. Summarise the record into a brief the broker can read in seconds: who they are, where things stand, and what matters. Use 3-5 short sentences of plain prose. Do not invent details.",
      prompt: ctx.context,
      maxTokens: 400,
    });
    // Swap the real names back in — the model only ever saw tokens.
    return NextResponse.json({ summary: ctx.restore(summary) });
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Summary failed", e);
    return NextResponse.json({ error: "The AI request failed. Please try again." }, { status: 502 });
  }
}
