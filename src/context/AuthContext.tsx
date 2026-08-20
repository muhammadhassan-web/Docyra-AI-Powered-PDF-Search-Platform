import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import type { AuthUser, EmployeeAccess } from '../types';
import { AuthContext, type RegisterInput } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [employeeAccessReveal, setEmployeeAccessReveal] = useState<EmployeeAccess | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await api.get<{ user: AuthUser }>('/api/auth/me');
            setUser(data.user);
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const login = useCallback(async (email: string, password: string) => {
        const data = await api.post<{ user: AuthUser }>('/api/auth/login', { email, password });
        setUser(data.user);
    }, []);

    const register = useCallback(async (input: RegisterInput) => {
        const data = await api.post<{ user: AuthUser; employeeAccess: EmployeeAccess }>('/api/auth/register', input);
        setUser(data.user);
        setEmployeeAccessReveal(data.employeeAccess);
    }, []);

    const employeeLogin = useCallback(async (companyCode: string, password: string) => {
        const data = await api.post<{ user: AuthUser }>('/api/auth/employee-login', { companyCode, password });
        setUser(data.user);
    }, []);

    const logout = useCallback(async () => {
        await api.post('/api/auth/logout');
        setUser(null);
    }, []);

    const clearEmployeeAccessReveal = useCallback(() => setEmployeeAccessReveal(null), []);

    return (
        <AuthContext.Provider value={{
            user, isLoading, login, register, employeeLogin, logout,
            employeeAccessReveal, clearEmployeeAccessReveal, refreshUser: refresh,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
