import axiosClient from './api';

export const userApi = {
  getAllUsers: (page: number = 1, size: number = 100) => {
    return axiosClient.get(`/api/users?page=${page}&size=${size}`);
  },
  
  deleteUser: (id: string) => {
    return axiosClient.delete(`/api/users/${id}`);
  }
};