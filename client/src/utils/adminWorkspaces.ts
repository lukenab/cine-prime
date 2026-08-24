const WORKSPACE_PATHS: Record<string, string[]> = {
  ROLE_ADMIN: ["/admin", "/admin/people", "/admin/access-matrix", "/admin/audit", "/admin/reports", "/admin/settings", "/admin/profile"],
  ROLE_SUPER_ADMIN: ["/admin", "/admin/people", "/admin/access-matrix", "/admin/audit", "/admin/reports", "/admin/settings", "/admin/profile"],
  ROLE_SYSTEM_ADMIN: ["/admin/people", "/admin/access-matrix", "/admin/audit", "/admin/settings", "/admin/profile"],
  ROLE_BRANCH_MANAGER: ["/admin/my-workforce", "/admin/showtimes", "/admin/bookings", "/admin/concessions", "/admin/workforce", "/admin/profile"],
  ROLE_PROGRAMMING_OPERATOR: ["/admin/programming", "/admin/movies", "/admin/screening-versions", "/admin/release-plans", "/admin/showtimes/auto", "/admin/formats", "/admin/genres", "/admin/age-ratings", "/admin/profile"],
  ROLE_PROGRAMMING_APPROVER: ["/admin/programming", "/admin/movies", "/admin/screening-versions", "/admin/release-plans", "/admin/showtimes/auto", "/admin/formats", "/admin/genres", "/admin/age-ratings", "/admin/profile"],
  ROLE_FINANCE_OFFICER: ["/admin/refunds-reconciliation", "/admin/bookings", "/admin/reports", "/admin/profile"],
  ROLE_FINANCE_APPROVER: ["/admin/refunds-reconciliation", "/admin/bookings", "/admin/audit", "/admin/reports", "/admin/profile"],
  ROLE_COMMERCIAL_MANAGER: ["/admin/price-books", "/admin/promotions", "/admin/reports", "/admin/profile"],
  ROLE_COMMERCIAL_APPROVER: ["/admin/price-books", "/admin/promotions", "/admin/reports", "/admin/profile"],
  ROLE_SECURITY_AUDITOR: ["/admin/audit", "/admin/reports", "/admin/profile"],
};

export function isPathInRoleWorkspace(role: string | undefined, path: string): boolean {
  if (!role) return false;
  const roots = WORKSPACE_PATHS[role];
  if (!roots) return true;
  return roots.some((root) => root === path || (root !== "/admin" && path.startsWith(`${root}/`)));
}

export function workspacePathsForRole(role: string): readonly string[] {
  return WORKSPACE_PATHS[role] ?? [];
}
