import { describe, expect, it } from "vitest";
import { JOB_ROLE_PRESETS } from "./employeeJobRoles";

describe("employee job-role presets", () => {
  it("maps cinema managers to branch-manager access", () => {
    expect(JOB_ROLE_PRESETS.find((preset) => preset.id === "CINEMA_MANAGER")).toMatchObject({
      department: "GENERAL_OPERATIONS",
      position: "CINEMA_MANAGER",
      accessRole: "BRANCH_MANAGER",
      location: "BRANCH",
    });
  });

  it("maps programming staff to head-office access", () => {
    expect(JOB_ROLE_PRESETS.find((preset) => preset.id === "FILM_PROGRAMMING_OPERATOR")).toMatchObject({
      department: "CONTENT_PROGRAMMING",
      position: "PROGRAMMING_OPERATOR",
      accessRole: "PROGRAMMING_OPERATOR",
      location: "HEAD_OFFICE",
    });
  });

  it("keeps ordinary cinema roles on employee access", () => {
    const ordinaryRoles = JOB_ROLE_PRESETS.filter((preset) =>
      preset.id !== "CINEMA_MANAGER" && preset.id !== "FILM_PROGRAMMING_OPERATOR");
    expect(ordinaryRoles).not.toHaveLength(0);
    expect(ordinaryRoles.every((preset) => preset.accessRole === "EMPLOYEE" && preset.location === "BRANCH")).toBe(true);
  });
});
