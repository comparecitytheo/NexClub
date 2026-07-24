import { z } from "zod";
import { optionalText, optionalNumber } from "./shared";

export const createCompanySchema = z.object({
  name: z.string().min(1, "Required").max(160),
  industry: optionalText(120),
  website: optionalText(200),
  employeeCount: optionalNumber(),
  revenue: optionalNumber(),
  address: optionalText(240),
  notes: optionalText(5000),
});

export const updateCompanySchema = createCompanySchema.partial();

export const listCompaniesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
});
