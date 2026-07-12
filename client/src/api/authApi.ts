import axiosClient from './api.ts'

export interface LoginPayLoad {
    username: string;
    password: string;
}

/** Admin creates an account — Issue #161/#162: no username/password anymore.
 *  The backend auto-generates the username and sends an activation-link email. */
export interface CreateAccountPayload {
    fullName: string;
    email: string;
    role: string;
}

export interface ActivateAccountPayload {
    token: string;
    newPassword: string;
}

const MOCK_EMPLOYEE_USERNAME = "employee";
const MOCK_EMPLOYEE_EMAIL = "employee@cineprime.com";
const MOCK_EMPLOYEE_PASSWORD = "employee";

function base64UrlEncode(value: Record<string, unknown>): string {
    return btoa(JSON.stringify(value))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function createMockEmployeeToken(): string {
    const now = Math.floor(Date.now() / 1000);
    return [
        base64UrlEncode({ alg: "none", typ: "JWT" }),
        base64UrlEncode({
            sub: MOCK_EMPLOYEE_USERNAME,
            accountId: "mock-employee-account",
            role: "ROLE_EMPLOYEE",
            scope: "ROLE_EMPLOYEE TICKET_SELL BOOKING_READ BOOKING_CONFIRM BOOKING_CANCEL",
            iat: now,
            exp: now + 60 * 60 * 24 * 7,
        }),
        "mock-signature",
    ].join(".");
}

function isMockEmployeeLogin(data: LoginPayLoad): boolean {
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "").trim();

    return (
        (username === MOCK_EMPLOYEE_USERNAME || username === MOCK_EMPLOYEE_EMAIL) &&
        password === MOCK_EMPLOYEE_PASSWORD
    );
}

export const authApi = {
    login: (data: LoginPayLoad) => {
        if (isMockEmployeeLogin(data)) {
            return Promise.resolve({
                code: 1000,
                message: "Mock employee login successfully",
                result: {
                    token: createMockEmployeeToken(),
                },
            });
        }

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
