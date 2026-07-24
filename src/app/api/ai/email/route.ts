import { NextResponse } from "next/server";
import { requireUser } from "@/server/api-helpers";
import { isAiConfigured, runClaudeJSON, AiError } from "@/server/ai";
import { buildEntityContext } from "@/server/ai-context";
import { aiEmailSchema } from "@/server/validators/ai";

type EmailResult = { subject: string; body: string };

export async function POST(req: Request) {
  const a = await requireUser();
  if ("error" in a) return a.error;
  const { user } = a;

  if (!isAiConfigured()) return NextResponse.json({ error: "AI features are not configured." }, { status: 400 });

  const parsed = aiEmailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { entityType, entityId, purpose, tone } = parsed.data;

  const ctx = await buildEntityContext(user, entityType, entityId);
  if (!ctx) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  try {
    const result = await runClaudeJSON<EmailResult>({
      system: `You are ${user.name}, a finance broker writing outreach emails. Write in a ${tone} tone. Keep it tight and specific to the recipient. Do not invent facts not present in the context. Sign off as ${user.name}. Use a placeholder only where information is genuinely missing.`,
      prompt: `Context about the recipient:\n${ctx.context}\n\nWrite an email for this purpose: ${purpose}\n\nReturn JSON with keys: "subject" (string) and "body" (string, plain text with line breaks).`,
      maxTokens: 900,
    });
    return NextResponse.json({
      subject: ctx.restore(result.subject ?? ""),
      body: ctx.restore(result.body ?? ""),
    });
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Email draft failed", e);
    return NextResponse.json({ error: "The AI request failed. Please try again." }, { status: 502 });
  }
}
