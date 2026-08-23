import { describe, expect, it } from "vitest";
import type { RoleRecord } from "../../api/authApi";
import { groupRoles, permissionGroup, permissionRisk, roleMeta } from "./accessMatrixMetadata";

describe("access matrix metadata", () => {
  it("separates customer and deprecated identities from operational staff roles", () => {
    const roles: RoleRecord[] = [
      { roleName: "MEMBER", permissions: [] },
      { roleName: "EMPLOYEE", permissions: [] },
      { roleName: "ADMIN", permissions: [] },
      { roleName: "FINANCE_APPROVER", permissions: [] },
    ];

    const grouped = groupRoles(roles);

    expect(grouped.find(group => group.id === "operational")?.roles.map(role => role.roleName)).toEqual(["EMPLOYEE"]);
    expect(grouped.find(group => group.id === "approval")?.roles.map(role => role.roleName)).toEqual(["FINANCE_APPROVER"]);
    expect(grouped.find(group => group.id === "customer")?.roles.map(role => role.roleName)).toEqual(["MEMBER"]);
    expect(grouped.find(group => group.id === "deprecated")?.roles.map(role => role.roleName)).toEqual(["ADMIN"]);
  });

  it("uses business-facing labels without changing stable technical keys", () => {
    expect(roleMeta("BRANCH_MANAGER").label).toBe("Cinema branch manager");
    expect(roleMeta("PROGRAMMING_OPERATOR").label).toBe("Release programming planner");
  });

  it("groups capabilities and marks elevated risk consistently", () => {
    expect(permissionGroup("REFUND_APPROVE").id).toBe("finance");
    expect(permissionRisk("REFUND_APPROVE")).toBe("approval");
    expect(permissionRisk("MOVIE_DELETE")).toBe("destructive");
    expect(permissionRisk("MOVIE_READ")).toBe("standard");
  });
});
