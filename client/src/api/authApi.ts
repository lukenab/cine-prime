import axiosClient from './api.ts'

export interface LoginPayLoad {
    username: string;
    password: string;
}

export const authApi = {
    login: (data: LoginPayLoad) => {
        return axiosClient.post('api/auth/login', data);
    },

    checkAvailability: (params: { username?: string; email?: string }) => {
        return axiosClient.get('/api/auth/check', { params });
    },

    initiateRegister: (payload: any) => {
        return axiosClient.post('/api/auth/register/initiate', payload);
    },

    verifyRegister: (payload: { email: string; otp: string }) => {
        return axiosClient.post('/api/auth/register/verify', payload);
    },
    
    resendOtp: (payload: { email: string }) => {
        return axiosClient.post('/api/auth/resend-otp', payload);
    },
  
    createAccount: (payload: any) => {
        return axiosClient.post('/api/accounts', payload); 
    },

    getAllAccounts: () => {
        return axiosClient.get('/api/accounts');
    },

    getAccountById: (accountId: string) => {
        return axiosClient.get(`/api/accounts/${accountId}`);
    },

    updateAccount: (accountId: string | undefined, payload: any) => {
        return axiosClient.put(`/api/accounts/${accountId}`, payload);
    },

    logout: () => {

        return axiosClient.post('/api/auth/logout');
    },

    refresh: (token: string) => {
        return axiosClient.post('/api/auth/refresh', { token });
    },
}