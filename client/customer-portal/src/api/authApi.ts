import axiosClient from './api.ts'

export interface LoginPayLoad {
    username: string;
    password: string;
}

export const authApi = {
    login: (data: LoginPayLoad) => {
        return axiosClient.post('api/auth/login', data);
    },

    register: (data: any) => {
        return axiosClient.post('api/auth/register', data);
    }
}