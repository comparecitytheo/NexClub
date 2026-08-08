import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserForWrite } from "@/server/api-helpers";
import { isAiConfigured, runClaudeJSON, AiError } from "@/server/ai";
import { buildEntityContext } from "@/server/ai-context";
import { entityLink } from "@/server/entity";
import { aiMeetingNotesSchema } from "@/server/validators/ai";

type NotesResult = { summary: string; actionItems: string[]; followUps: string[] };

export async function POST(req: Request) {
  const a = await requireUserForWrite();
  if ("error" in a) return a.error;
  const { user } = a;

  if (!isAiConfigured()) return NextResponse.json({ error: "AI features are not configured." }, { status: 400 });

  const parsed = aiMeetingNotesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  const { entityType, entityId, notes, createTasks } = parsed.data;

  const ctx = await buildEntityContext(user, entityType, entityId);
  if (!ctx) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  try {
    const result = await runClaudeJSON<NotesResult>({
      system:
        "You are a CRM assistant. Turn messy meeting notes into a clean record. Be faithful to the notes; do not invent commitments that are not implied.",
      prompt: `Context:\n${ctx.context}\n\nRaw meeting notes:\n${notes}\n\nReturn JSON with keys: "summary" (2-4 sentence recap), "actionItems" (array of short imperative tasks), "followUps" (array of short follow-up reminders).`,
      maxTokens: 800,
    });

    // Restore real names BEFORE anything is persisted — the summary is written to
    // an activity record and the action items become task titles, so tokens must
    // never reach the database.
    const summary = ctx.restore(result.summary ?? "");
    const actionItems = (Array.isArray(result.actionItems) ? result.actionItems.slice(0, 10) : []).map((t) =>
      typeof t === "string" ? ctx.restore(t) : t
    );
    const followUps = (Array.isArray(result.followUps) ? result.followUps.slice(0, 10) : []).map((t) =>
      typeof t === "string" ? ctx.restore(t) : t
    );

    // Log the meeting as an activity on the record.
    await prisma.activity.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        type: "MEETING",
        subject: "Meeting notes (AI summary)",
        body: summary,
        entityType,
        ...entityLink(entityType, entityId),
      },
    });

    // Optionally turn action items into tasks assigned to the current user.
    let tasksCreated = 0;
    if (createTasks && actionItems.length > 0) {
      const due = new Date();
      due.setDate(due.getDate() + 3);
      await prisma.$transaction(
        actionItems.slice(0, 5).map((title) =>
          prisma.task.create({
            data: {
              organizationId: user.organizationId,
              creatorId: user.id,
              assigneeId: user.id,
              title: title.slice(0, 200),
              dueDate: due,
              priority: "MEDIUM",
              entityType,
              ...entityLink(entityType, entityId),
            },
          })
        )
      );
      tasksCreated = Math.min(actionItems.length, 5);
    }

    return NextResponse.json({ summary, actionItems, followUps, tasksCreated });
  } catch (e) {
    if (e instanceof AiError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Meeting notes failed", e);
    return NextResponse.json({ error: "The AI request failed. Please try again." }, { status: 502 });
  }
}
