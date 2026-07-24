import { z } from "zod";
import { LeadStatus, SentLeadStatus, LeadSource, LeadPriority } from "@prisma/client";
import { optionalText, optionalEmail, optionalNumber, optionalDate } from "./shared";

// Creating a lead = sending it: ownerId is the recipient member.
export const createLeadSchema = z.object({
  ownerId: z.string().min(1, "Choose a member to send this lead to"),
  contactName: z.string().min(1, "Required").max(160),
  company: optionalText(160),
  phone: optionalText(40),
  email: optionalEmail(),
  industry: optionalText(120),
  valueEstimate: optionalNumber(),
  source: z.nativeEnum(LeadSource).default(LeadSource.REFERRAL),
  followUpDate: optionalDate(),
  notes: optionalText(5000),
  priority: z.nativeEnum(LeadPriority).default(LeadPriority.LOW),
  // Must be literally true: a lead cannot be sent without confirming consent.
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Confirm you have this person's consent before sending." }),
  }),
});

export const updateLeadSchema = z.object({
  contactName: z.string().min(1).max(160).optional(),
  company: optionalText(160),
  phone: optionalText(40),
  email: optionalEmail(),
  industry: optionalText(120),
  valueEstimate: optionalNumber(),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  followUpDate: optionalDate(),
  notes: optionalText(5000),
  ownerId: z.string().optional(),
});

// Kanban move: new column + new index within the column.
export const moveLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  boardPosition: z.coerce.number().int().min(0).default(0),
  // The stage the client believes the lead is currently in. When present, the
  // server applies the move only if the lead is still in this stage (concurrency guard).
  fromStatus: z.nativeEnum(LeadStatus).optional(),
});

// Outbound "Sent Leads" board: the sender moves a lead through its sent lifecycle.
export const moveSentLeadSchema = z.object({
  sentStatus: z.nativeEnum(SentLeadStatus),
});

// Revenue recorded against a lead (its value; counts toward revenue once Closed / Won).
export const leadRevenueSchema = z.object({
  valueEstimate: optionalNumber(),
});

// A comment on a lead (stored as a Note).
export const leadCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(5000),
});

export const listLeadsSchema = z.object({
  view: z.enum(["received", "sent", "all"]).default("received"),
  q: z.string().optional(),
});

export const convertLeadSchema = z.object({
  createContact: z.boolean().default(true),
  createCompany: z.boolean().default(true),
  createDeal: z.boolean().default(true),
  dealValue: optionalNumber(),
});
