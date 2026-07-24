import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";
// This import is required for the `declare module "next-auth/jwt"` block
// below to register as an augmentation instead of being ignored.
import type {} from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: UserRole;
    organizationId: string;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    organizationId: string;
  }
}
