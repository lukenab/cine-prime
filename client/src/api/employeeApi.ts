import axiosClient from './api';

export interface EmployeeCreatePayload {
  accountId:      string;
  cinemaId?:      string;
  position:       EmployeePosition;
  department:     EmployeeDepartment;   // @NotNull in backend
  employmentType: EmploymentType;       // @NotNull in backend
  hireDate:       string;
}

export interface EmployeeUpdatePayload {
  cinemaId?: string;
  position?: EmployeePosition;
  department?: EmployeeDepartment;
  employmentType?: EmploymentType;
  hireDate?: string;
}

export interface EmployeeInvitationPayload {
  fullName: string;
  email: string;
  phoneNumber?: string;
  cinemaId?: string;
  position: EmployeePosition;
  department: EmployeeDepartment;
  employmentType: EmploymentType;
  hireDate: string;
  accessRole: 'EMPLOYEE' | 'BRANCH_MANAGER' | 'PROGRAMMING_OPERATOR' | 'PROGRAMMING_APPROVER'
    | 'FINANCE_OFFICER' | 'FINANCE_APPROVER' | 'COMMERCIAL_MANAGER' | 'SECURITY_AUDITOR' | 'SYSTEM_ADMIN';
}

export type EmployeePosition =
  | 'TEAM_MEMBER'
  | 'ASSISTANT_MANAGER'
  | 'CINEMA_MANAGER'
  | 'PROGRAMMING_OPERATOR'
  | 'PROGRAMMING_APPROVER'
  | 'FINANCE_OFFICER'
  | 'FINANCE_APPROVER'
  | 'COMMERCIAL_MANAGER'
  | 'SYSTEM_ADMINISTRATOR'
  | 'SECURITY_AUDITOR'
  // Legacy API values retained while existing records are migrated.
  | 'STAFF'
  | 'SUPERVISOR'
  | 'MANAGER';

export type EmployeeDepartment =
  | 'GENERAL_OPERATIONS'
  | 'BOX_OFFICE'
  | 'FOOD_BEVERAGE'
  | 'FLOOR_GUEST_SERVICES'
  | 'PROJECTION_TECHNICAL'
  | 'FACILITIES_MAINTENANCE'
  | 'CONTENT_PROGRAMMING'
  | 'FINANCE'
  | 'COMMERCIAL'
  | 'INFORMATION_TECHNOLOGY'
  | 'RISK_COMPLIANCE'
  // Legacy API values retained while existing records are migrated.
  | 'CONCESSION'
  | 'FLOOR'
  | 'PROJECTION'
  | 'MANAGEMENT'
  | 'CUSTOMER_SERVICE';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'FIXED_TERM'
  | 'SEASONAL'
  // Legacy API values retained while existing records are migrated.
  | 'PROBATION'
  | 'INTERN'
  | 'CONTRACT';

/** Shape returned by GET /api/employees and GET /api/employees/{id} */
export interface EmployeeResponse {
  // Employee fields
  employeeId: string;
  employeeCode: string | null;
  cinemaId: string | null;
  position: EmployeePosition;
  department: EmployeeDepartment | null;
  employmentType: EmploymentType | null;
  hireDate: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  // User profile fields (from linked User entity)
  accountId: string;
  fullName: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  identityCard: string;
  avatarUrl: string | null;
}

export const employeeApi = {
  getMe: () =>
    axiosClient.get<any>('/api/employees/me'),

  getAll: (page = 1, size = 200) =>
    axiosClient.get<any>(`/api/employees?page=${page}&size=${size}`),

  getById: (id: string) =>
    axiosClient.get<any>(`/api/employees/${id}`),

  create: (payload: EmployeeCreatePayload) =>
    axiosClient.post<any>('/api/employees', payload),

  invite: (payload: EmployeeInvitationPayload) =>
    axiosClient.post<any>('/api/employees/invitations', payload),

  update: (id: string, payload: EmployeeUpdatePayload) =>
    axiosClient.put<any>(`/api/employees/${id}`, payload),

  disable: (id: string) =>
    axiosClient.delete<any>(`/api/employees/${id}`),

  reactivate: (id: string) =>
    axiosClient.post<any>(`/api/employees/${id}/reactivate`),
};
