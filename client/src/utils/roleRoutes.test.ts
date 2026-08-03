import { describe, expect, it } from "vitest";
import { defaultPathForRole, EMPLOYEE_HOME_PATH } from "./roleRoutes";

describe("defaultPathForRole", () => {
  it("keeps employees outside the admin workspace", () => {
    expect(defaultPathForRole("ROLE_EMPLOYEE")).toBe(EMPLOYEE_HOME_PATH);
  });

  it("routes administrative roles to their own workspaces", () => {
    expect(defaultPathForRole("ROLE_ADMIN")).toBe("/admin");
    expect(defaultPathForRole("ROLE_SUPER_ADMIN")).toBe("/admin");
    expect(defaultPathForRole("ROLE_BRANCH_MANAGER")).toBe("/admin/concessions/catalog");
    expect(defaultPathForRole("ROLE_PROGRAMMING_OPERATOR")).toBe("/admin/programming");
  });

  it("returns customer roles to the storefront", () => {
    expect(defaultPathForRole("ROLE_MEMBER")).toBe("/");
  });
});
