import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "@/server/validators/profile";
import { resolveInviteScope } from "@/lib/rbac";

describe("a member cannot move themselves into another business", () => {
  it("strips businessName from a profile update", () => {
    // This field used to be accepted here, which meant any user could type
    // another business's name and be treated as part of it.
    const parsed = updateProfileSchema.parse({ businessName: "Sharma Financial" } as never);
    expect("businessName" in parsed).toBe(false);
  });

  it("strips their own name too — only a Super Admin renames people", () => {
    const parsed = updateProfileSchema.parse({ name: "Someone Else" } as never);
    expect("name" in parsed).toBe(false);
  });

  it("still accepts the fields a member legitimately owns", () => {
    const parsed = updateProfileSchema.parse({
      services: "Bookkeeping",
      phone: "+61 400 000 000",
      bio: "Twenty years in bookkeeping.",
    });
    expect(parsed.services).toBe("Bookkeeping");
    expect(parsed.phone).toBe("+61 400 000 000");
  });
});

describe("an admin cannot invite into a business they do not belong to", () => {
  it("ignores the submitted business and uses the caller's own", () => {
    const scope = resolveInviteScope({
      callerRole: "ADMIN",
      callerBusinessName: "Webb Consulting",
      submittedBusinessName: "Sharma Financial",
    });
    expect(scope.businessName).toBe("Webb Consulting");
  });

  it("leaves the invite unusable when the caller has no business", () => {
    // The route rejects an empty business name, so an admin with no business
    // cannot invite anyone at all rather than inviting into a blank one.
    const scope = resolveInviteScope({
      callerRole: "ADMIN",
      callerBusinessName: null,
      submittedBusinessName: "Sharma Financial",
    });
    expect(scope.businessName).toBe("");
  });

  it("still lets a super admin name any business", () => {
    const scope = resolveInviteScope({
      callerRole: "SUPER_ADMIN",
      callerBusinessName: "NEX Club",
      submittedBusinessName: "A Brand New Business",
    });
    expect(scope.businessName).toBe("A Brand New Business");
  });
});
