export const EMPLOYEE_HOME_PATH = "/employee";

export function defaultPathForRole(role: string): string {
  if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") return "/admin";
  if (role === "ROLE_PROGRAMMING_OPERATOR") return "/admin/programming";
  if (role === "ROLE_PROGRAMMING_APPROVER") return "/admin/release-plans";
  if (role === "ROLE_SYSTEM_ADMIN") return "/admin/people";
  if (role === "ROLE_FINANCE_OFFICER" || role === "ROLE_FINANCE_APPROVER") return "/admin/refunds-reconciliation";
  if (role === "ROLE_COMMERCIAL_MANAGER") return "/admin/price-books";
  if (role === "ROLE_COMMERCIAL_APPROVER") return "/admin/promotions";
  if (role === "ROLE_SECURITY_AUDITOR") return "/admin/audit";
  if (role === "ROLE_BRANCH_MANAGER") return "/admin/concessions/catalog";
  if (role === "ROLE_EMPLOYEE") return EMPLOYEE_HOME_PATH;
  return "/";
}
