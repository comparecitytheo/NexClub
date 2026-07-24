import { PrismaClient, Prisma } from "@prisma/client";

// Models carrying a `deletedAt` column.
const SOFT_DELETE_MODELS = new Set([
  "User", "Organization", "Team", "Company", "Contact", "Lead", "Deal", "Task", "Note",
]);

const READ_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
]);

function buildClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return base
    // Read filtering: never return soft-deleted rows from list/aggregate reads.
    // (findUnique is left untouched — it requires a unique-only where. To
    // exclude soft-deleted by id, use findFirst({ where: { id } }).)
    .$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (model && SOFT_DELETE_MODELS.has(model) && READ_OPS.has(operation)) {
              const a = (args ?? {}) as { where?: Record<string, unknown> };
              a.where = { deletedAt: null, ...a.where };
              return query(a);
            }
            return query(args);
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
