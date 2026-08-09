import axiosClient from './api';

export const userApi = {
  getAllUsers: (page: number = 1, size: number = 100) => {
    return axiosClient.get(`/api/users?page=${page}&size=${size}`);
  },

  getUserById: (id: string) => {
    return axiosClient.get(`/api/users/${id}`);
  },

  updateUser: (id: string, payload: Record<string, any>) => {
    return axiosClient.put(`/api/users/${id}`, payload);
  },

  completeStaffProfile: (id: string, payload: { fullName: string; phoneNumber: string }) => {
    return axiosClient.put(`/api/users/${id}/staff-profile`, payload);
  },

  uploadAvatar: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    // axiosClient sets a default "Content-Type: application/json" header that
    // persists even for FormData bodies. Clear it here so the browser can set
    // the correct "multipart/form-data; boundary=..." header itself.
    return axiosClient.post(`/api/users/${id}/avatar`, form, {
      headers: { "Content-Type": undefined },
    });
  },

  deleteUser: (id: string) => {
    return axiosClient.delete(`/api/users/${id}`);
  },
};
