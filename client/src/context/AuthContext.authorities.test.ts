import { describe, expect, it } from "vitest";
import { extractAuthorities, extractPrimaryRole } from "./AuthContext";

describe("JWT authority parsing", () => {
  it("keeps ROLE_MANAGE as a permission instead of treating it as a staff role", () => {
    const scope = "ROLE_SYSTEM_ADMIN ROLE_MANAGE SYSTEM_CONFIG_MANAGE AUDIT_READ";

    expect(extractPrimaryRole(scope)).toBe("ROLE_SYSTEM_ADMIN");
    expect(extractAuthorities(scope)).toEqual({
      roles: ["ROLE_SYSTEM_ADMIN"],
      permissions: ["ROLE_MANAGE", "SYSTEM_CONFIG_MANAGE", "AUDIT_READ"],
    });
  });
});
