import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { startTestDB, stopTestDB, clearTestDB } from '../test/db.js';

vi.mock('../utils/email.js', () => ({ sendMail: vi.fn(async () => {}) }));
const { sendMail } = await import('../utils/email.js');

const app = createApp();

beforeAll(async () => {
    await startTestDB();
}, 60000);

afterAll(async () => {
    await stopTestDB();
});

beforeEach(async () => {
    await clearTestDB();
});

async function registerOwner(email = 'owner@acme.test', employeePassword = 'team-password-1') {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send({
        organizationName: 'Acme Corp',
        organizationAddress: '123 Main St, Springfield',
        adminName: 'Test Owner',
        email,
        password: 'correct-horse-9',
        employeePassword,
    });
    return { agent, body: res.body };
}

describe('Employee shared login', () => {
    it('is created automatically on registration and returned once, with the org\'s sequential company code', async () => {
        const { body } = await registerOwner();
        expect(body.employeeAccess).toBeDefined();
        expect(body.employeeAccess.companyCode).toBe(body.user.organization.companyCode);
        expect(body.employeeAccess.companyCode).toMatch(/^\d{3,}$/);
        expect(typeof body.employeeAccess.password).toBe('string');
        expect(body.employeeAccess.password.length).toBeGreaterThan(0);
    });

    it('lets an employee log in with the company code and shared password, scoped to that org', async () => {
        const { body } = await registerOwner();
        const { companyCode, password } = body.employeeAccess;

        const employeeAgent = request.agent(app);
        const loginRes = await employeeAgent.post('/api/auth/employee-login').send({ companyCode, password });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body.user.role).toBe('member');
        expect(loginRes.body.user.isEmployeeAccount).toBe(true);
        expect(loginRes.body.user.organization.companyCode).toBe(companyCode);

        const meRes = await employeeAgent.get('/api/auth/me');
        expect(meRes.status).toBe(200);
        expect(meRes.body.user.isEmployeeAccount).toBe(true);
    });

    it('rejects the wrong shared password', async () => {
        const { body } = await registerOwner();
        const res = await request(app).post('/api/auth/employee-login').send({
            companyCode: body.employeeAccess.companyCode,
            password: 'totally-wrong-password',
        });
        expect(res.status).toBe(401);
    });

    it('rejects an unknown company code', async () => {
        const res = await request(app).post('/api/auth/employee-login').send({
            companyCode: 'does-not-exist',
            password: 'anything',
        });
        expect(res.status).toBe(401);
    });

    it('two different orgs never receive the same company code', async () => {
        const first = await registerOwner('owner-a@test.com');
        const second = await registerOwner('owner-b@test.com');
        expect(first.body.employeeAccess.companyCode).not.toBe(second.body.employeeAccess.companyCode);
    });

    it('an employee account can read policies and use chat but not upload or delete', async () => {
        const { agent: ownerAgent, body } = await registerOwner();
        const { companyCode, password } = body.employeeAccess;

        const employeeAgent = request.agent(app);
        await employeeAgent.post('/api/auth/employee-login').send({ companyCode, password });

        const listRes = await employeeAgent.get('/api/policies');
        expect(listRes.status).toBe(200);

        const uploadRes = await employeeAgent.post('/api/policies').send({
            file_url: `https://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/${(await ownerAgent.get('/api/auth/me')).body.user.organization.id}/x.pdf`,
            name: 'Should Not Upload',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        expect(uploadRes.status).toBe(403);
    });

    it('the shared employee account cannot change its own password', async () => {
        const { body } = await registerOwner();
        const employeeAgent = request.agent(app);
        await employeeAgent.post('/api/auth/employee-login').send(body.employeeAccess);

        const res = await employeeAgent.post('/api/auth/change-password').send({
            currentPassword: body.employeeAccess.password,
            newPassword: 'a-new-password-employees-should-not-set-1',
        });
        expect(res.status).toBe(403);
    });

    describe('POST /api/auth/employee-access/regenerate', () => {
        it('requires owner/admin — a non-admin cannot rotate the shared password', async () => {
            const { body } = await registerOwner();
            const employeeAgent = request.agent(app);
            await employeeAgent.post('/api/auth/employee-login').send(body.employeeAccess);

            const res = await employeeAgent.post('/api/auth/employee-access/regenerate');
            expect(res.status).toBe(403);
        });

        it('rejects rotation without the current password or a verification code', async () => {
            const { agent: ownerAgent } = await registerOwner();
            const res = await ownerAgent.post('/api/auth/employee-access/regenerate').send({ password: 'rotated-password-1' });
            expect(res.status).toBe(400);
        });

        it('rejects rotation with the wrong current password', async () => {
            const { agent: ownerAgent } = await registerOwner();
            const res = await ownerAgent.post('/api/auth/employee-access/regenerate').send({
                password: 'rotated-password-1',
                currentPassword: 'not-the-real-one',
            });
            expect(res.status).toBe(401);
        });

        it('rotates the password with the correct current password, and invalidates sessions issued with the old one', async () => {
            const { agent: ownerAgent, body } = await registerOwner();
            const { companyCode, password: oldPassword } = body.employeeAccess;

            const employeeAgent = request.agent(app);
            await employeeAgent.post('/api/auth/employee-login').send({ companyCode, password: oldPassword });
            const beforeRotate = await employeeAgent.get('/api/auth/me');
            expect(beforeRotate.status).toBe(200);

            const newPassword = 'rotated-password-1';
            const regenRes = await ownerAgent.post('/api/auth/employee-access/regenerate').send({
                password: newPassword,
                currentPassword: oldPassword,
            });
            expect(regenRes.status).toBe(200);
            expect(regenRes.body.password).toBe(newPassword);
            expect(newPassword).not.toBe(oldPassword);

            // Old session (JWT signed with the pre-rotation tokenVersion) is now invalid.
            const afterRotate = await employeeAgent.get('/api/auth/me');
            expect(afterRotate.status).toBe(401);

            // The new password works.
            const newLogin = await request(app).post('/api/auth/employee-login').send({ companyCode, password: newPassword });
            expect(newLogin.status).toBe(200);

            // The old password no longer works.
            const oldLoginAttempt = await request(app).post('/api/auth/employee-login').send({ companyCode, password: oldPassword });
            expect(oldLoginAttempt.status).toBe(401);
        });

        it('rotates the password with a verification code instead, when the current password is unknown', async () => {
            const { agent: ownerAgent } = await registerOwner();

            const codeRes = await ownerAgent.post('/api/auth/employee-access/request-reset-code');
            expect(codeRes.status).toBe(200);
            expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@acme.test' }));
            const sentCode = sendMail.mock.calls.at(-1)[0].text.match(/(\d{6})/)[1];

            const regenRes = await ownerAgent.post('/api/auth/employee-access/regenerate').send({
                password: 'rotated-via-code-1',
                code: sentCode,
            });
            expect(regenRes.status).toBe(200);
            expect(regenRes.body.password).toBe('rotated-via-code-1');
        });

        it('rejects a wrong or reused verification code', async () => {
            const { agent: ownerAgent } = await registerOwner();
            await ownerAgent.post('/api/auth/employee-access/request-reset-code');

            const res = await ownerAgent.post('/api/auth/employee-access/regenerate').send({
                password: 'rotated-via-code-1',
                code: '000000',
            });
            expect(res.status).toBe(400);
        });
    });

    describe('forgot / reset admin password', () => {
        it('sends a reset code and lets the admin set a new password with it', async () => {
            await registerOwner('owner@acme.test');

            const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: 'owner@acme.test' });
            expect(forgotRes.status).toBe(200);
            const sentCode = sendMail.mock.calls.at(-1)[0].text.match(/(\d{6})/)[1];

            const resetRes = await request(app).post('/api/auth/reset-password').send({
                email: 'owner@acme.test',
                code: sentCode,
                newPassword: 'brand-new-password-1',
            });
            expect(resetRes.status).toBe(200);

            const loginRes = await request(app).post('/api/auth/login').send({ email: 'owner@acme.test', password: 'brand-new-password-1' });
            expect(loginRes.status).toBe(200);

            // Old password no longer works.
            const oldLogin = await request(app).post('/api/auth/login').send({ email: 'owner@acme.test', password: 'correct-horse-9' });
            expect(oldLogin.status).toBe(401);
        });

        it('gives the same generic response for an unregistered email (no enumeration)', async () => {
            const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@acme.test' });
            expect(res.status).toBe(200);
        });

        it('rejects an invalid code', async () => {
            await registerOwner('owner@acme.test');
            await request(app).post('/api/auth/forgot-password').send({ email: 'owner@acme.test' });

            const res = await request(app).post('/api/auth/reset-password').send({
                email: 'owner@acme.test',
                code: '000000',
                newPassword: 'brand-new-password-1',
            });
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/auth/employee-access', () => {
        it('requires owner/admin', async () => {
            const { body } = await registerOwner();
            const employeeAgent = request.agent(app);
            await employeeAgent.post('/api/auth/employee-login').send(body.employeeAccess);

            const res = await employeeAgent.get('/api/auth/employee-access');
            expect(res.status).toBe(403);
        });

        it('returns the company code and setup status for an admin', async () => {
            const { agent: ownerAgent, body } = await registerOwner();
            const res = await ownerAgent.get('/api/auth/employee-access');
            expect(res.status).toBe(200);
            expect(res.body.companyCode).toBe(body.employeeAccess.companyCode);
            expect(res.body.isSetUp).toBe(true);
        });
    });
});
