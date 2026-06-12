import axiosClient from './api.ts'

export interface LoginPayLoad {
    username: string;
    password: string;
}

export const authApi = {
    login: (data: LoginPayLoad) => {
        return axiosClient.post('api/auth/login', data);
    },

    initiateRegister: (payload: any) => {
    return axiosClient.post('/api/auth/register/initiate', payload);
  },

  verifyRegister: (payload: { otp: string, registerRequest: any }) => {
    return axiosClient.post('/api/auth/register/verify', payload);
  }
}
