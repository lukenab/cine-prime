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

  deleteUser: (id: string) => {
    return axiosClient.delete(`/api/users/${id}`);
  },
};
