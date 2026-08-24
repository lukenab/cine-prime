import { describe, expect, it } from "vitest";
import { isPathInRoleWorkspace, workspacePathsForRole } from "./adminWorkspaces";

describe("admin role workspaces", () => {
  it("keeps legacy administrators in the platform administration workspace", () => {
    expect(isPathInRoleWorkspace("ROLE_ADMIN", "/admin/people")).toBe(true);
    expect(isPathInRoleWorkspace("ROLE_ADMIN", "/admin/my-workforce")).toBe(false);
    expect(isPathInRoleWorkspace("ROLE_ADMIN", "/admin/promotions")).toBe(false);
  });

  it("separates employee self-service from system administration", () => {
    expect(isPathInRoleWorkspace("ROLE_BRANCH_MANAGER", "/admin/my-workforce")).toBe(true);
    expect(isPathInRoleWorkspace("ROLE_SYSTEM_ADMIN", "/admin/my-workforce")).toBe(false);
    expect(isPathInRoleWorkspace("ROLE_SYSTEM_ADMIN", "/admin/access-matrix/compare")).toBe(true);
  });

  it("gives every business role a non-empty focused workspace", () => {
    for (const role of [
      "ROLE_BRANCH_MANAGER", "ROLE_PROGRAMMING_OPERATOR", "ROLE_PROGRAMMING_APPROVER",
      "ROLE_FINANCE_OFFICER", "ROLE_FINANCE_APPROVER", "ROLE_COMMERCIAL_MANAGER",
      "ROLE_COMMERCIAL_APPROVER", "ROLE_SECURITY_AUDITOR", "ROLE_SYSTEM_ADMIN",
    ]) {
      expect(workspacePathsForRole(role).length).toBeGreaterThan(0);
    }
  });
});
