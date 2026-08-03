export const EMPLOYEE_HOME_PATH = "/employee";

export function defaultPathForRole(role: string): string {
  if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") return "/admin";
  if (role === "ROLE_PROGRAMMING_OPERATOR") return "/admin/programming";
  if (role === "ROLE_BRANCH_MANAGER") return "/admin/concessions/catalog";
  if (role === "ROLE_EMPLOYEE") return EMPLOYEE_HOME_PATH;
  return "/";
}
