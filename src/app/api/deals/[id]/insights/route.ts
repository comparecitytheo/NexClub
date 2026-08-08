import { NextResponse } from "next/server";
import { requireUserForWrite } from "@/server/api-helpers";
import { isAiConfigured, runClaudeJSON, AiError } from "@/server/ai";
import { buildEntityContext } from "@/server/ai-context";

type Params = { params: Promise<{ id: string }> };
type Insights = { health: string; summary: string; risks: string[]; nextActions: string[] };

export async function POST(_req: Request, { params }: Params) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;
  const { id } = await params;

  if (!isAiConfigured()) return NextResponse.json({ error: "AI features are not configured." }, { status: 400 });

  const ctx = await buildEntityContext(user, "DEAL", id);
  if (!ctx) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  try {
    const result = await runClaudeJSON<Insights>({
      system:
        "You are a sales coach reviewing a deal in a CRM for an Australian finance brokerage. Give a candid, practical assessment focused on what will move the deal forward.",
      prompt: `${ctx.context}\n\nReturn JSON with keys: "health" (one of "strong", "moderate", "at_risk"), "summary" (2-3 sentences), "risks" (array of up to 3 short strings), "nextActions" (array of up to 3 short, concrete next steps).`,
      maxTokens: 600,
    });
    return NextResponse.json({
      health: result.health ?? "moderate",
      summary: result.summary ?? "",
      risks: Array.isArray(result.risks) ? result.risks.slice(0, 5) : [],
      nextActions: Array.isArray(result.nextActions) ? result.nextActions.slice(0, 5) : [],
    });
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Deal insights failed", e);
    return NextResponse.json({ error: "The AI request failed. Please try again." }, { status: 502 });
  }
}
