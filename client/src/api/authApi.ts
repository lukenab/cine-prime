import axiosClient from './api.ts'

export interface LoginPayLoad {
    username: string;
    password: string;
}

export interface GoogleLoginPayload {
    credential: string;
}

/** Admin creates an account — Issue #161/#162: no username/password anymore.
 *  The backend auto-generates the username and sends an activation-link email. */
export interface CreateAccountPayload {
    fullName: string;
    email: string;
    role: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    gender?: string;
    identityCard?: string;
    address?: string;
}

export interface ActivateAccountPayload {
    token: string;
    newPassword: string;
}

export interface PermissionRecord { permissionName: string; description?: string }
export interface RoleRecord { roleName: string; description?: string; permissions: PermissionRecord[] }

export const authApi = {
    login: (data: LoginPayLoad) => axiosClient.post('api/auth/login', data),

    loginWithGoogle: (data: GoogleLoginPayload) => {
        return axiosClient.post('/api/auth/google', data);
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

    forgotPassword: (email: string) => {
        return axiosClient.post('/api/auth/password/forgot', { email });
    },

    resetPassword: (payload: { token: string; newPassword: string }) => {
        return axiosClient.post('/api/auth/password/reset', payload);
    },

    /** Admin-only. Issue #161/#162: payload is now { fullName, email, role } — no
     *  username/password. Account is created PENDING; an activation email is sent. */
    createAccount: (payload: CreateAccountPayload) => {
        return axiosClient.post('/api/accounts', payload);
    },

    /** Public — employee sets their own password using the token from the
     *  activation email. See Issue #161/#162. */
    activateAccount: (payload: ActivateAccountPayload) => {
        return axiosClient.post('/api/auth/activate-account', payload);
    },

    /** Admin-only. Resends the activation email when the original link (24h TTL)
     *  expired before the employee used it. */
    resendActivation: (accountId: string) => {
        return axiosClient.post(`/api/accounts/${accountId}/resend-activation`);
    },

    revokeSessions: (accountId: string) => {
        return axiosClient.post(`/api/accounts/${accountId}/revoke-sessions`);
    },

    getAllAccounts: () => {
        return axiosClient.get('/api/accounts');
    },

    searchAccounts: (params: { query?: string; status?: string; role?: string; page?: number; size?: number }) => {
        return axiosClient.get('/api/accounts/search', { params });
    },

    getAccountStats: () => {
        return axiosClient.get('/api/accounts/stats');
    },

    getAccountById: (accountId: string) => {
        return axiosClient.get(`/api/accounts/${accountId}`);
    },

    getMyAccount: () => {
        return axiosClient.get('/api/accounts/my-info');
    },

    updateAccount: (accountId: string | undefined, payload: any) => {
        return axiosClient.put(`/api/accounts/${accountId}`, payload);
    },

    getRoles: () => axiosClient.get('/api/roles'),
    getPermissions: () => axiosClient.get('/api/permissions'),
    updateRolePermissions: (roleName: string, permissions: string[], changeReason?: string) =>
        axiosClient.put(`/api/roles/${encodeURIComponent(roleName)}/permissions`, { permissions, changeReason }),

    logout: (token?: string | null) => {
        return axiosClient.post('/api/auth/logout', undefined, token ? {
            headers: { Authorization: `Bearer ${token}` },
        } : undefined);
    },

    refresh: (token: string) => {
        return axiosClient.post('/api/auth/refresh', { token });
    },
}
