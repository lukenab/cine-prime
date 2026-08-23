import type { PermissionRecord, RoleRecord } from "../../api/authApi";

export const protectedRoles = new Set(["SUPER_ADMIN", "ADMIN", "SYSTEM_ADMIN", "MEMBER"]);

export type RoleCategoryId = "operational" | "approval" | "platform" | "customer" | "deprecated";

export const roleCategories: Array<{ id: RoleCategoryId; label: string }> = [
  { id: "operational", label: "Operational roles" },
  { id: "approval", label: "Approval & governance" },
  { id: "platform", label: "Platform roles" },
  { id: "customer", label: "Customer access" },
  { id: "deprecated", label: "Deprecated" },
];

const roleMetadata: Record<string, { label: string; purpose: string; category: RoleCategoryId; order: number }> = {
  EMPLOYEE: { label: "Cinema crew member", purpose: "Handles frontline ticketing and day-to-day cinema services.", category: "operational", order: 10 },
  BRANCH_MANAGER: { label: "Cinema branch manager", purpose: "Manages branch-scoped staff and operational workflows.", category: "operational", order: 20 },
  PROGRAMMING_OPERATOR: { label: "Release programming planner", purpose: "Prepares movie content, release plans and schedule drafts.", category: "operational", order: 30 },
  FINANCE_OFFICER: { label: "Finance operations officer", purpose: "Investigates refunds, payments and reconciliation cases.", category: "operational", order: 40 },
  COMMERCIAL_MANAGER: { label: "Commercial manager", purpose: "Owns cinema pricing, promotions and commercial configuration.", category: "operational", order: 50 },
  PROGRAMMING_APPROVER: { label: "Programming approver", purpose: "Reviews and approves programming submissions.", category: "approval", order: 10 },
  FINANCE_APPROVER: { label: "Finance approver", purpose: "Approves financial exceptions and refund decisions.", category: "approval", order: 20 },
  SECURITY_AUDITOR: { label: "Security auditor", purpose: "Reviews security and operational audit evidence without modifying it.", category: "approval", order: 30 },
  SYSTEM_ADMIN: { label: "System administrator", purpose: "Manages identity, access and system configuration.", category: "platform", order: 10 },
  SUPER_ADMIN: { label: "Super administrator", purpose: "Protected platform recovery and unrestricted administration role.", category: "platform", order: 20 },
  MEMBER: { label: "Customer member", purpose: "Uses customer booking, promotion and account features.", category: "customer", order: 10 },
  ADMIN: { label: "Legacy administrator", purpose: "Compatibility role retained only during migration to business roles.", category: "deprecated", order: 10 },
};

export function roleMeta(name: string) {
  return roleMetadata[name] ?? {
    label: name.toLowerCase().replaceAll("_", " ").replace(/^./, value => value.toUpperCase()),
    purpose: "Custom role managed by CinePrime administration.",
    category: "operational" as RoleCategoryId,
    order: 999,
  };
}

export function groupRoles(roles: RoleRecord[]) {
  return roleCategories.map(category => ({
    ...category,
    roles: roles
      .filter(role => roleMeta(role.roleName).category === category.id)
      .sort((left, right) => roleMeta(left.roleName).order - roleMeta(right.roleName).order),
  })).filter(category => category.roles.length > 0);
}

export type CapabilityGroup = { id: string; label: string; description: string; prefixes: string[] };

export const capabilityGroups: CapabilityGroup[] = [
  { id: "catalog", label: "Movie catalogue", description: "Movie records, genres and customer-facing content.", prefixes: ["MOVIE_", "GENRE_"] },
  { id: "programming", label: "Release programming", description: "Release plans and maker-checker scheduling workflows.", prefixes: ["RELEASE_PLAN_", "SCHEDULE_PLAN_"] },
  { id: "showtimes", label: "Showtime operations", description: "Cinema schedules and screening operations.", prefixes: ["SHOWTIME_"] },
  { id: "bookings", label: "Bookings & ticketing", description: "Bookings, cancellations and counter ticket sales.", prefixes: ["BOOKING_", "TICKET_"] },
  { id: "facilities", label: "Cinema facilities", description: "Screening rooms and seat configurations.", prefixes: ["ROOM_"] },
  { id: "commercial", label: "Commercial operations", description: "Pricing, promotions and concession catalogue workflows.", prefixes: ["PRICE_BOOK_", "PROMOTION_", "CONCESSION_"] },
  { id: "finance", label: "Finance & reconciliation", description: "Payments, refunds and reconciliation decisions.", prefixes: ["PAYMENT_", "REFUND_", "RECONCILIATION_"] },
  { id: "workforce", label: "Workforce operations", description: "Rosters, attendance, timesheets and staff requests.", prefixes: ["WORKFORCE_", "ATTENDANCE_", "TIMESHEET_"] },
  { id: "people", label: "People & access", description: "Employee, customer and role administration.", prefixes: ["EMPLOYEE_", "USER_", "ROLE_"] },
  { id: "governance", label: "Governance & reporting", description: "Reports, audit evidence and system configuration.", prefixes: ["REPORT_", "AUDIT_", "SYSTEM_"] },
];

export type RiskLevel = "standard" | "sensitive" | "approval" | "destructive";
export const riskLabels: Record<Exclude<RiskLevel, "standard">, string> = {
  sensitive: "Sensitive", approval: "Approval authority", destructive: "Destructive",
};

export function permissionLabel(permission: PermissionRecord) {
  return permission.description?.trim() || permission.permissionName.toLowerCase().replaceAll("_", " ").replace(/^./, value => value.toUpperCase());
}

export function permissionGroup(name: string) {
  return capabilityGroups.find(group => group.prefixes.some(prefix => name.startsWith(prefix))) ?? capabilityGroups[capabilityGroups.length - 1];
}

export function permissionRisk(name: string): RiskLevel {
  if (name.endsWith("_DELETE")) return "destructive";
  if (name.includes("APPROVE") || name.includes("ACTIVATE") || name.includes("PUBLISH")) return "approval";
  if (name.includes("MANAGE") || name.includes("RESOLVE") || name.includes("CONFIG") || name.includes("CLOCK")) return "sensitive";
  return "standard";
}

export function sameSet(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every(value => right.has(value));
}
