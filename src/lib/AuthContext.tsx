"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Role = "SUPER_ADMIN" | "ADMIN" | "OPERATOR";

interface User {
    id: string;
    username: string;
    role: Role;
    accessId?: string;
    accessName?: string;
}

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    role: Role | undefined;
    assignedAccessId: string | null;
    logout: () => void;
    setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUserState] = useState<User | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem("parking_user");
        if (savedUser) {
            try {
                setUserState(JSON.parse(savedUser));
            } catch (e) {
                console.error("Error parsing saved user", e);
            }
        }
    }, []);

    const setUser = (newUser: User | null) => {
        setUserState(newUser);
        if (newUser) {
            localStorage.setItem("parking_user", JSON.stringify(newUser));
        } else {
            localStorage.removeItem("parking_user");
        }
    };

    const setRole = (role: Role) => {
        if (!user) return;
        const updatedUser = { ...user, role };
        setUser(updatedUser);
    };

    const logout = () => {
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            isAdmin: user?.role === "ADMIN" || user?.role === "SUPER_ADMIN",
            isSuperAdmin: user?.role === "SUPER_ADMIN",
            role: user?.role,
            assignedAccessId: user?.accessId || null,
            logout,
            setRole
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
