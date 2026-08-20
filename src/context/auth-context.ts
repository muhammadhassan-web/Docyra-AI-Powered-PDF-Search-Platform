import { createContext } from 'react';
import type { AuthUser, CompanySize, EmployeeAccess } from '../types';

export interface RegisterInput {
    organizationName: string;
    organizationAddress: string;
    industry?: string;
    companySize?: CompanySize;
    adminName: string;
    email: string;
    password: string;
}

export interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    employeeLogin: (companyCode: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    // Shown once, right after a new company registers — the only time this
    // plaintext password is ever available. See EmployeeAccessRevealModal.
    employeeAccessReveal: EmployeeAccess | null;
    clearEmployeeAccessReveal: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
