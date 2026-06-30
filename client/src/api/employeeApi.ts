import axiosClient from './api';

export interface EmployeeCreatePayload {
  accountId: string;
  cinemaId?: string;
  position: EmployeePosition;
  department?: EmployeeDepartment;
  employmentType?: EmploymentType;
  hireDate: string;
}

export interface EmployeeUpdatePayload {
  cinemaId?: string;
  position?: EmployeePosition;
  department?: EmployeeDepartment;
  employmentType?: EmploymentType;
  hireDate?: string;
}

export type EmployeePosition =
  | 'STAFF'
  | 'SUPERVISOR'
  | 'MANAGER';

export type EmployeeDepartment =
  | 'BOX_OFFICE'
  | 'CONCESSION'
  | 'FLOOR'
  | 'PROJECTION'
  | 'MANAGEMENT'
  | 'CUSTOMER_SERVICE';

export type EmploymentType =
  | 'FULL_TIME'
  | 'PART_TIME'
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
  getAll: (page = 1, size = 200) =>
    axiosClient.get<any>(`/api/employees?page=${page}&size=${size}`),

  getById: (id: string) =>
    axiosClient.get<any>(`/api/employees/${id}`),

  create: (payload: EmployeeCreatePayload) =>
    axiosClient.post<any>('/api/employees', payload),

  update: (id: string, payload: EmployeeUpdatePayload) =>
    axiosClient.put<any>(`/api/employees/${id}`, payload),

  disable: (id: string) =>
    axiosClient.delete<any>(`/api/employees/${id}`),
};
