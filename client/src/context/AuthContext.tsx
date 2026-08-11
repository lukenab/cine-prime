import { authApi } from "../api/authApi";
import { userApi } from "../api/userApi";
import { jwtDecode } from "jwt-decode";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const ROLE_PRIORITY = ["ROLE_SUPER_ADMIN", "ROLE_ADMIN", "ROLE_PROGRAMMING_OPERATOR", "ROLE_BRANCH_MANAGER", "ROLE_EMPLOYEE", "ROLE_MEMBER"];

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

function requiresProfile(role: string): boolean {
    return ["ROLE_MEMBER", "ROLE_EMPLOYEE", "ROLE_BRANCH_MANAGER", "ROLE_PROGRAMMING_OPERATOR"].includes(role);
}

async function checkProfileComplete(accountId: string): Promise<boolean> {
    try {
        const res: any = await userApi.getUserById(accountId);
        const profile = res?.result ?? res?.data?.result ?? res?.data ?? res;
        return profile?.profileCompleted === true;
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) return false;
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
    profileCheckPending: boolean;
    setNeedsProfileSetup: (v: boolean) => void;
    login: (credentials: any) => Promise<{ role: string; needsSetup: boolean }>;
    loginWithGoogle: (credential: string) => Promise<{ role: string; needsSetup: boolean }>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
    const [profileCheckPending, setProfileCheckPending] = useState(false);

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

            if (requiresProfile(primaryRole) && accountId) {
                setProfileCheckPending(true);
                if (localStorage.getItem("__dev_forceProfileSetup") === "1") {
                    setNeedsProfileSetup(true);
                    setProfileCheckPending(false);
                } else checkProfileComplete(accountId).then((complete) => {
                    setNeedsProfileSetup(!complete);
                    setProfileCheckPending(false);
                });
            }
        } catch {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
        }
    }, []);

    const establishSession = async (response: any): Promise<{ role: string; needsSetup: boolean }> => {
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
        if (requiresProfile(primaryRole) && accountId) {
            setProfileCheckPending(true);
            if (localStorage.getItem("__dev_forceProfileSetup") === "1") {
                needsSetup = true;
            } else {
                const complete = await checkProfileComplete(accountId);
                needsSetup = !complete;
            }
            setNeedsProfileSetup(needsSetup);
            setProfileCheckPending(false);
        } else {
            setNeedsProfileSetup(false);
            setProfileCheckPending(false);
        }

        return { role: primaryRole, needsSetup };
    };

    const login = async (credentials: any): Promise<{ role: string; needsSetup: boolean }> => {
        return establishSession(await authApi.login(credentials));
    };

    const loginWithGoogle = async (credential: string): Promise<{ role: string; needsSetup: boolean }> => {
        return establishSession(await authApi.loginWithGoogle({ credential }));
    };

    const logout = () => {
        const token = localStorage.getItem("accessToken");
        authApi.logout(token).catch(() => {});

        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.removeItem("jwt_token");
        setUser(null);
        setNeedsProfileSetup(false);
        setProfileCheckPending(false);
    };

    return (
        <AuthContext.Provider value={{ user, needsProfileSetup, profileCheckPending, setNeedsProfileSetup, login, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
};
