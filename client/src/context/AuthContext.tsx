import { authApi } from "../api/authApi";
import { userApi } from "../api/userApi";
import { jwtDecode } from "jwt-decode";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const ROLE_PRIORITY = ["ROLE_ADMIN", "ROLE_EMPLOYEE", "ROLE_MEMBER"];
const MOCK_EMPLOYEE_USERNAME = "employee";
const MOCK_EMPLOYEE_EMAIL = "employee@cineprime.com";
const MOCK_EMPLOYEE_PASSWORD = "employee";

function extractPrimaryRole(rolesClaim: string): string {
    const roles = (rolesClaim || "").split(" ").filter(r => r.startsWith("ROLE_"));
    for (const r of ROLE_PRIORITY) {
        if (roles.includes(r)) return r;
    }
    return roles[0] || "";
}

function isTokenExpired(token: string): boolean {
    try {
        const decoded: any = jwtDecode(token);
        return !decoded.exp || decoded.exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

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
            scope: "ROLE_EMPLOYEE TICKET_SELL BOOKING_READ BOOKING_CONFIRM BOOKING_CANCEL",
            iat: now,
            exp: now + 60 * 60 * 24 * 7,
        }),
        "mock-signature",
    ].join(".");
}

function isMockEmployeeCredentials(credentials: any): boolean {
    const username = String(credentials?.username ?? "").trim().toLowerCase();
    const password = String(credentials?.password ?? "").trim();
    return (
        (username === MOCK_EMPLOYEE_USERNAME || username === MOCK_EMPLOYEE_EMAIL) &&
        password === MOCK_EMPLOYEE_PASSWORD
    );
}

async function checkProfileComplete(accountId: string): Promise<boolean> {
    try {
        const res: any = await userApi.getUserById(accountId);
        const profile = res?.result ?? res?.data?.result ?? res?.data ?? res;
        return profile?.profileCompleted === true;
    } catch (err: any) {
        const status = err?.response?.status;
        // 404 = user record chưa tồn tại trong user-service → cần hoàn thiện profile
        if (status === 404) return false;
        // Lỗi khác (network, 5xx) → fail open, không chặn user
        return true;
    }
}

interface User {
    username: string;
    role: string;
    accountId: string;
}

interface AuthContextType {
    user: User | null;
    needsProfileSetup: boolean;
    setNeedsProfileSetup: (v: boolean) => void;
    login: (credentials: any) => Promise<{ role: string; needsSetup: boolean }>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        if (isTokenExpired(token)) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
            return;
        }

        try {
            const decoded: any = jwtDecode(token);
            const primaryRole = extractPrimaryRole(decoded.scope ?? decoded.role ?? "");
            const accountId = decoded.accountId ?? decoded.sub;

            setUser({ username: decoded.sub, role: primaryRole, accountId });

            // Re-check profile completeness on page refresh
            if (primaryRole === "ROLE_MEMBER" && accountId) {
                if (localStorage.getItem("__dev_forceProfileSetup") === "1") {
                    setNeedsProfileSetup(true);
                } else checkProfileComplete(accountId).then((complete) => {
                    setNeedsProfileSetup(!complete);
                });
            }
        } catch {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
        }
    }, []);

    const login = async (credentials: any): Promise<{ role: string; needsSetup: boolean }> => {
        if (isMockEmployeeCredentials(credentials)) {
            const token = createMockEmployeeToken();
            localStorage.setItem("accessToken", token);
            localStorage.setItem("role", "ROLE_EMPLOYEE");
            setUser({ username: MOCK_EMPLOYEE_USERNAME, role: "ROLE_EMPLOYEE", accountId: "mock-employee-account" });
            setNeedsProfileSetup(false);
            return { role: "ROLE_EMPLOYEE", needsSetup: false };
        }

        const response = await authApi.login(credentials);
        const resBody = response?.data ?? response;
        const token = resBody?.result?.token || resBody?.token || response?.result?.token;

        if (!token) throw new Error("Login failed: missing token in response");

        localStorage.setItem("accessToken", token);

        const decoded: any = jwtDecode(token);
        const primaryRole = extractPrimaryRole(decoded.scope ?? decoded.role ?? "");
        const accountId = decoded.accountId ?? decoded.sub;

        localStorage.setItem("role", primaryRole);
        setUser({ username: decoded.sub, role: primaryRole, accountId });

        let needsSetup = false;
        if (primaryRole === "ROLE_MEMBER" && accountId) {
            if (localStorage.getItem("__dev_forceProfileSetup") === "1") {
                needsSetup = true;
            } else {
                const complete = await checkProfileComplete(accountId);
                needsSetup = !complete;
            }
            setNeedsProfileSetup(needsSetup);
        } else {
            setNeedsProfileSetup(false);
        }

        return { role: primaryRole, needsSetup };
    };

    const logout = async () => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            try { await authApi.logout(); } catch { /* ignore */ }
        }
        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.removeItem("jwt_token");
        setUser(null);
        setNeedsProfileSetup(false);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, needsProfileSetup, setNeedsProfileSetup, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};
