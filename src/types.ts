export type PolicyDepartment = 'HR' | 'IT';

export interface Policy {
    _id: string;
    name: string;
    department: PolicyDepartment;
    lastUpdated: string;
    file_url?: string;
    content?: string;
}

export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    companyCode: string;
}

export interface AuthUser {
    id: string;
    name?: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
    isEmployeeAccount: boolean;
    organization: Organization;
}

export interface EmployeeAccess {
    companyCode: string;
    password: string;
}
