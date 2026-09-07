import { PrismaClient, Prisma } from "@prisma/client";

// Models carrying a `deletedAt` column.
const SOFT_DELETE_MODELS = new Set([
  "User", "Organization", "Team", "Company", "Contact", "Lead", "Deal", "Task", "Note",
]);

const READ_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
]);

// The reads that can carry `include`/`select`, and therefore pull relations in
// alongside the row. findUnique is here even though it is absent from READ_OPS:
// its own `where` must stay unique-only, but the relations hanging off it still
// need filtering.
const FIND_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
]);

/**
 * Relation field -> target model, per model, read from the generated datamodel.
 *
 * Built once at module load. Taking it from the DMMF rather than hand-listing
 * relations means a relation added by a future schema change is covered the day
 * it lands, with nothing to remember.
 */
type Relation = { target: string; isList: boolean };

const RELATIONS: Map<string, Map<string, Relation>> = (() => {
  const byModel = new Map<string, Map<string, Relation>>();
  for (const model of Prisma.dmmf.datamodel.models) {
    const fields = new Map<string, Relation>();
    for (const field of model.fields) {
      if (field.kind === "object" && typeof field.type === "string") {
        fields.set(field.name, { target: field.type, isList: Boolean(field.isList) });
      }
    }
    byModel.set(model.name, fields);
  }
  return byModel;
})();

/** The implicit `where` for a model, or null when it hides nothing. */
function scopeFor(model: string): Record<string, null> | null {
  if (!SOFT_DELETE_MODELS.has(model)) return null;
  // Archived leads are Super Admin only, the same as at the top level.
  return model === "Lead" ? { deletedAt: null, archivedAt: null } : { deletedAt: null };
}

/** Merge the implicit scope under whatever the caller asked for, so an explicit
 *  `deletedAt` (the archive views) still wins. */
function withScope(scope: Record<string, null>, existing: unknown): Record<string, unknown> {
  return { ...scope, ...((existing as Record<string, unknown> | undefined) ?? {}) };
}

/**
 * Filtered relation counts: `_count: { select: { taskEntries: true } }` counts
 * soft-deleted rows unless the relation carries its own `where`, which is why
 * the lead list showed a task badge of 3 for a lead with one live task.
 */
function filterCount(model: string, node: unknown): void {
  const relations = RELATIONS.get(model);
  if (!relations || !node || typeof node !== "object") return;
  const select = (node as { select?: Record<string, unknown> }).select;
  if (!select || typeof select !== "object") return;

  for (const [field, value] of Object.entries(select)) {
    const relation = relations.get(field);
    if (!relation) continue;
    const scope = scopeFor(relation.target);
    if (!scope) continue;
    if (value === true) {
      select[field] = { where: { ...scope } };
    } else if (value && typeof value === "object") {
      const branch = value as Record<string, unknown>;
      branch.where = withScope(scope, branch.where);
    }
  }
}

/**
 * Push the soft-delete filter down through `include`/`select` into every nested
 * relation, recursively.
 *
 * The top-level filter below only rewrites the `where` of the model being
 * queried, so a relation pulled in alongside it came back unfiltered: a task
 * deleted from a lead reappeared the next time that lead was opened, because
 * the detail route reads `taskEntries` as a nested include. Same for notes on a
 * lead and tasks on a deal.
 *
 * Descends even into relations that are not themselves soft-deletable — the
 * interesting one may be a level further down.
 */
function filterNested(model: string, node: Record<string, unknown>): void {
  const relations = RELATIONS.get(model);
  if (!relations) return;

  for (const key of ["include", "select"] as const) {
    const block = node[key];
    if (!block || typeof block !== "object") continue;

    for (const [field, value] of Object.entries(block as Record<string, unknown>)) {
      if (field === "_count") {
        filterCount(model, value);
        continue;
      }
      const relation = relations.get(field);
      if (!relation) continue;
      // A to-one relation takes no `where` — Prisma rejects it. Only lists do,
      // so `lead.owner` is descended into but never filtered.
      const scope = relation.isList ? scopeFor(relation.target) : null;

      if (value === true) {
        // `include: { taskEntries: true }` has nowhere to hang a filter, so it
        // becomes an object. Prisma returns the same scalar fields either way.
        if (scope) (block as Record<string, unknown>)[field] = { where: { ...scope } };
        continue;
      }
      if (value && typeof value === "object") {
        const branch = value as Record<string, unknown>;
        if (scope) branch.where = withScope(scope, branch.where);
        filterNested(relation.target, branch);
      }
    }
  }
}

/**
 * Apply both halves of the read scope to one call's `args`, in place.
 *
 * Exported so the rules can be tested without a database — the extension below
 * is a thin wrapper around this.
 */
export function applyReadScope(
  model: string | undefined,
  operation: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  if (!model) return args;

  if (SOFT_DELETE_MODELS.has(model) && READ_OPS.has(operation)) {
    args.where = withScope(scopeFor(model) as Record<string, null>, args.where);
  }
  if (FIND_OPS.has(operation)) filterNested(model, args);

  return args;
}

function buildClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base
    // Read filtering: never return soft-deleted rows from list/aggregate reads,
    // nor from any relation pulled in beside them.
    // (findUnique's own `where` is left untouched — it requires a unique-only
    // where. To exclude soft-deleted by id, use findFirst({ where: { id } }).)
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Raw operations arrive with no model and a non-object `args`; the
            // guard below leaves those untouched.
            //
            // Excluding here rather than per-endpoint means every list, search,
            // count, aggregate and export is covered by default — no route can
            // leak them by forgetting a filter. The Super Admin archive views
            // pass an explicit `archivedAt`, which wins on spread order and is
            // the only way to read those rows.
            const a = (args ?? {}) as { where?: Record<string, unknown> };
            applyReadScope(model, operation, a as Record<string, unknown>);
            return query(a);
          },
        },
      },
    })
    // Soft-delete helpers. Use these instead of delete()/deleteMany() for
    // soft-deletable models so rows are flagged rather than removed.
    .$extends({
      model: {
        $allModels: {
          async softDelete<T>(this: T, where: unknown) {
            const ctx = Prisma.getExtensionContext(this) as unknown as {
              update: (a: unknown) => Promise<unknown>;
            };
            return ctx.update({ where, data: { deletedAt: new Date() } });
          },
          async softDeleteMany<T>(this: T, where: unknown) {
            const ctx = Prisma.getExtensionContext(this) as unknown as {
              updateMany: (a: unknown) => Promise<unknown>;
            };
            return ctx.updateMany({ where, data: { deletedAt: new Date() } });
          },
          async restore<T>(this: T, where: unknown) {
            const ctx = Prisma.getExtensionContext(this) as unknown as {
              update: (a: unknown) => Promise<unknown>;
            };
            return ctx.update({ where, data: { deletedAt: null } });
          },
        },
      },
    });
}

type ExtendedPrismaClient = ReturnType<typeof buildClient>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
