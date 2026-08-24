import { describe, expect, it } from "vitest";
import { defaultPathForRole, EMPLOYEE_HOME_PATH } from "./roleRoutes";

describe("defaultPathForRole", () => {
  it("keeps employees outside the admin workspace", () => {
    expect(defaultPathForRole("ROLE_EMPLOYEE")).toBe(EMPLOYEE_HOME_PATH);
  });

  it("routes administrative roles to their own workspaces", () => {
    expect(defaultPathForRole("ROLE_ADMIN")).toBe("/admin");
    expect(defaultPathForRole("ROLE_SUPER_ADMIN")).toBe("/admin");
    expect(defaultPathForRole("ROLE_BRANCH_MANAGER")).toBe("/admin/workforce");
    expect(defaultPathForRole("ROLE_PROGRAMMING_OPERATOR")).toBe("/admin/programming");
    expect(defaultPathForRole("ROLE_PROGRAMMING_APPROVER")).toBe("/admin/programming/approvals");
    expect(defaultPathForRole("ROLE_SYSTEM_ADMIN")).toBe("/admin/people");
    expect(defaultPathForRole("ROLE_FINANCE_OFFICER")).toBe("/admin/refunds-reconciliation");
    expect(defaultPathForRole("ROLE_FINANCE_APPROVER")).toBe("/admin/refunds-reconciliation");
    expect(defaultPathForRole("ROLE_COMMERCIAL_MANAGER")).toBe("/admin/price-books");
    expect(defaultPathForRole("ROLE_COMMERCIAL_APPROVER")).toBe("/admin/promotions");
    expect(defaultPathForRole("ROLE_SECURITY_AUDITOR")).toBe("/admin/audit");
  });

  it("returns customer roles to the storefront", () => {
    expect(defaultPathForRole("ROLE_MEMBER")).toBe("/");
  });
});
