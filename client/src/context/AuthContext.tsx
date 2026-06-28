import { authApi } from "../api/authApi";
import { jwtDecode } from "jwt-decode";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const ROLE_PRIORITY = ["ROLE_ADMIN", "ROLE_EMPLOYEE", "ROLE_MEMBER", "ROLE_USER"];

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
        // decoded.exp is in seconds; Date.now() in milliseconds
        return !decoded.exp || decoded.exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

interface User {
    username: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    login: (credentials: any) => Promise<void>;
    logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {

    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        // Reject expired tokens immediately — don't wait for a 401
        if (isTokenExpired(token)) {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
            return;
        }

        try {
            const decoded: any = jwtDecode(token);
            setUser({
                username: decoded.sub,
                role: extractPrimaryRole(decoded.role ?? decoded.scope),
            });
        } catch {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
        }
    }, []);

    const login = async (credentials: any) => {
        const response = await authApi.login(credentials);

        // axios interceptor may already return response.data, support both shapes
        const resBody = response?.data ?? response;
        const token = resBody?.result?.token || resBody?.token || response?.result?.token;

        if (!token) {
            throw new Error("Login failed: missing token in response");
        }

        localStorage.setItem("accessToken", token);

        const decoded: any = jwtDecode(token);
        const primaryRole = extractPrimaryRole(decoded.role ?? decoded.scope);
        localStorage.setItem("role", primaryRole);

        setUser({ username: decoded.sub, role: primaryRole });
    };

    const logout = async () => {
        const token = localStorage.getItem("accessToken");

        // Revoke token on the server so it can't be reused even if stolen.
        // Token được gửi tự động qua Authorization header bởi axios interceptor.
        if (token) {
            try {
                await authApi.logout();
            } catch {
                // Ignore — proceed with local cleanup regardless
            }
        }

        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.removeItem("jwt_token"); // clean up legacy key
        setUser(null);
        window.location.href = "/login";
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside AuthProvider");
    }
    return context;
};