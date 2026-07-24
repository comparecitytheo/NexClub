import { z } from "zod";
import { DealStage } from "@prisma/client";
import { optionalNumber, optionalDate } from "./shared";

// companyId / contactId use plain optional strings so "" can clear the link on edit.
export const createDealSchema = z.object({
  name: z.string().min(1, "Required").max(160),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  value: optionalNumber(),
  stage: z.nativeEnum(DealStage).default(DealStage.PROSPECTING),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: optionalDate(),
});

export const updateDealSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  value: optionalNumber(),
  stage: z.nativeEnum(DealStage).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: optionalDate(),
});

export const moveDealSchema = z.object({
  stage: z.nativeEnum(DealStage),
  boardPosition: z.coerce.number().int().min(0).default(0),
});

export const listDealsSchema = z.object({ q: z.string().optional() });
