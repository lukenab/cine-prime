import type {
  EmployeeDepartment,
  EmployeePosition,
  EmployeeInvitationPayload,
} from "../../api/employeeApi";

export type JobRolePresetId =
  | "BOX_OFFICE_TEAM_MEMBER"
  | "CONCESSION_TEAM_MEMBER"
  | "GUEST_SERVICES_TEAM_MEMBER"
  | "PROJECTION_TECHNICIAN"
  | "FACILITIES_TECHNICIAN"
  | "OPERATIONS_SUPERVISOR"
  | "ASSISTANT_CINEMA_MANAGER"
  | "CINEMA_MANAGER"
  | "FILM_PROGRAMMING_OPERATOR"
  | "FILM_PROGRAMMING_APPROVER"
  | "FINANCE_OFFICER"
  | "FINANCE_APPROVER"
  | "COMMERCIAL_MANAGER"
  | "COMMERCIAL_APPROVER"
  | "SYSTEM_ADMINISTRATOR"
  | "SECURITY_AUDITOR";

export type JobRolePreset = {
  id: JobRolePresetId;
  label: string;
  description: string;
  department: EmployeeDepartment;
  position: EmployeePosition;
  accessRole: EmployeeInvitationPayload["accessRole"];
  location: "BRANCH" | "HEAD_OFFICE";
};

export const DEFAULT_JOB_ROLE_ID: JobRolePresetId = "CONCESSION_TEAM_MEMBER";

export const JOB_ROLE_PRESETS: JobRolePreset[] = [
  { id: "BOX_OFFICE_TEAM_MEMBER", label: "Box office team member", description: "Ticket sales, booking support and customer check-in.", department: "BOX_OFFICE", position: "TEAM_MEMBER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "CONCESSION_TEAM_MEMBER", label: "Concession team member", description: "Food, beverage and counter operations.", department: "FOOD_BEVERAGE", position: "TEAM_MEMBER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "GUEST_SERVICES_TEAM_MEMBER", label: "Guest services team member", description: "Lobby, ushering and customer experience operations.", department: "FLOOR_GUEST_SERVICES", position: "TEAM_MEMBER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "PROJECTION_TECHNICIAN", label: "Projection technician", description: "Projection, presentation quality and technical support.", department: "PROJECTION_TECHNICAL", position: "TEAM_MEMBER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "FACILITIES_TECHNICIAN", label: "Facilities technician", description: "Cinema facilities and routine maintenance operations.", department: "FACILITIES_MAINTENANCE", position: "TEAM_MEMBER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "OPERATIONS_SUPERVISOR", label: "Operations supervisor", description: "Supervises day-to-day cinema operations and team members.", department: "GENERAL_OPERATIONS", position: "SUPERVISOR", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "ASSISTANT_CINEMA_MANAGER", label: "Assistant cinema manager", description: "Supports branch leadership without account-provisioning authority.", department: "GENERAL_OPERATIONS", position: "ASSISTANT_MANAGER", accessRole: "EMPLOYEE", location: "BRANCH" },
  { id: "CINEMA_MANAGER", label: "Cinema manager", description: "Manages branch-scoped staff and operational workflows.", department: "GENERAL_OPERATIONS", position: "CINEMA_MANAGER", accessRole: "BRANCH_MANAGER", location: "BRANCH" },
  { id: "FILM_PROGRAMMING_OPERATOR", label: "Film programming & scheduling", description: "Prepares movie, release-plan and schedule drafts for administrator approval.", department: "CONTENT_PROGRAMMING", position: "PROGRAMMING_OPERATOR", accessRole: "PROGRAMMING_OPERATOR", location: "HEAD_OFFICE" },
  { id: "FILM_PROGRAMMING_APPROVER", label: "Programming approver", description: "Reviews movie content, release plans and schedules created by programming operators.", department: "CONTENT_PROGRAMMING", position: "PROGRAMMING_APPROVER", accessRole: "PROGRAMMING_APPROVER", location: "HEAD_OFFICE" },
  { id: "FINANCE_OFFICER", label: "Finance officer", description: "Investigates refunds, payment attempts and reconciliation exceptions.", department: "FINANCE", position: "FINANCE_OFFICER", accessRole: "FINANCE_OFFICER", location: "HEAD_OFFICE" },
  { id: "FINANCE_APPROVER", label: "Finance approver", description: "Approves financial exceptions and high-risk refund decisions.", department: "FINANCE", position: "FINANCE_APPROVER", accessRole: "FINANCE_APPROVER", location: "HEAD_OFFICE" },
  { id: "COMMERCIAL_MANAGER", label: "Commercial manager", description: "Owns price books, commercial offers and promotion configuration.", department: "COMMERCIAL", position: "COMMERCIAL_MANAGER", accessRole: "COMMERCIAL_MANAGER", location: "HEAD_OFFICE" },
  { id: "COMMERCIAL_APPROVER", label: "Commercial approver", description: "Reviews promotion submissions and controls customer-facing activation.", department: "COMMERCIAL", position: "COMMERCIAL_APPROVER", accessRole: "COMMERCIAL_APPROVER", location: "HEAD_OFFICE" },
  { id: "SYSTEM_ADMINISTRATOR", label: "System administrator", description: "Manages identities, access and system configuration without business approval authority.", department: "INFORMATION_TECHNOLOGY", position: "SYSTEM_ADMINISTRATOR", accessRole: "SYSTEM_ADMIN", location: "HEAD_OFFICE" },
  { id: "SECURITY_AUDITOR", label: "Security auditor", description: "Read-only access to audit evidence and compliance reports.", department: "RISK_COMPLIANCE", position: "SECURITY_AUDITOR", accessRole: "SECURITY_AUDITOR", location: "HEAD_OFFICE" },
];

export const getJobRolePreset = (id: JobRolePresetId) =>
  JOB_ROLE_PRESETS.find((preset) => preset.id === id) ?? JOB_ROLE_PRESETS[0];
