import { z } from "zod";

// Shared by the create and update routes so the rules can never drift apart.
export const eventSchema = z.object({
  title: z.string().trim().min(3, "Give the event a title").max(140),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startsAt: z.string().datetime({ offset: true }).or(z.string().min(1, "Choose a start date and time")),
  endsAt: z.string().optional().or(z.literal("")),
});

export const rsvpSchema = z.object({
  status: z.enum(["GOING", "NOT_GOING"]),
});
