import { authApi } from "../api/authApi";
import { jwtDecode } from "jwt-decode";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
    username: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    login: (credentials: any) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {

    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            try {
                const decoded: any = jwtDecode(token);

                setUser({
                    username: decoded.sub,
                    role: decoded.role
                });
            } catch (error) {
                console.error("Fail to get token", error);

                localStorage.removeItem("accessToken");
                localStorage.removeItem("role"); 
            }
        }
    }, []);

    const login = async (credentials: any) => {
        const response = await authApi.login(credentials);

        // axios interceptor may already return response.data, support both shapes
        const resBody = response?.data ?? response;
        const token = resBody?.result?.token || resBody?.token || response?.result?.token;

        if (!token) {
            throw new Error('Login failed: missing token in response');
        }

        localStorage.setItem("accessToken", token);

        const decoded: any = jwtDecode(token);

        localStorage.setItem("role", decoded.role);

        setUser({
            username: decoded.sub,
            role: decoded.role
        });
    };

    const logout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("role"); 
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