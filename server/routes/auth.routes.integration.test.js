import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { startTestDB, stopTestDB, clearTestDB } from '../test/db.js';
import User from '../models/User.js';

const app = createApp();

const VALID_PASSWORD = 'correct-horse-9';
const WRONG_PASSWORD = 'totally-wrong-9';

function registerPayload(overrides = {}) {
    return {
        organizationName: 'Acme Corp',
        organizationAddress: '123 Main St, Springfield',
        adminName: 'Ada Owner',
        email: 'owner@acme.test',
        password: VALID_PASSWORD,
        employeePassword: 'team-password-1',
        ...overrides,
    };
}

beforeAll(async () => {
    await startTestDB();
}, 60000);

afterAll(async () => {
    await stopTestDB();
});

beforeEach(async () => {
    await clearTestDB();
});

describe('POST /api/auth/register', () => {
    it('creates an org (with a sequential company code) and an owner user, and sets an auth cookie', async () => {
        const res = await request(app).post('/api/auth/register').send(registerPayload());

        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('owner');
        expect(res.body.user.name).toBe('Ada Owner');
        expect(res.body.user.organization.name).toBe('Acme Corp');
        expect(res.body.user.organization.companyCode).toMatch(/^\d{3,}$/);
        expect(res.body.employeeAccess.companyCode).toBe(res.body.user.organization.companyCode);
        expect(res.headers['set-cookie']?.[0]).toMatch(/docyra_token=/);
    });

    it('assigns sequential, non-colliding company codes to different orgs', async () => {
        const first = await request(app).post('/api/auth/register').send(registerPayload({ email: 'a@acme.test' }));
        const second = await request(app).post('/api/auth/register').send(registerPayload({ organizationName: 'Beta Inc', email: 'b@beta.test' }));

        expect(first.body.user.organization.companyCode).not.toBe(second.body.user.organization.companyCode);
        expect(Number(second.body.user.organization.companyCode)).toBeGreaterThan(Number(first.body.user.organization.companyCode));
    });

    it('rejects a weak password (no digit)', async () => {
        const res = await request(app).post('/api/auth/register').send(registerPayload({ password: 'no-digits-here' }));
        expect(res.status).toBe(400);
    });

    it('rejects a duplicate email with a clean 409, not a 500', async () => {
        await request(app).post('/api/auth/register').send(registerPayload({ email: 'dupe@acme.test' }));

        const res = await request(app).post('/api/auth/register').send(
            registerPayload({ organizationName: 'Different Org', email: 'dupe@acme.test' })
        );

        expect(res.status).toBe(409);
    });

    it('does not leave an orphaned Organization when User creation fails inside the transaction', async () => {
        // Pre-seed a user so the second register call fails on the duplicate-email
        // check *inside* the transaction, after the Organization would have been
        // created in the old non-transactional flow.
        await request(app).post('/api/auth/register').send(registerPayload({ email: 'existing@acme.test' }));

        const Organization = (await import('../models/Organization.js')).default;
        const before = await Organization.countDocuments();

        await request(app).post('/api/auth/register').send(
            registerPayload({ organizationName: 'Should Not Persist', email: 'existing@acme.test' })
        );

        const after = await Organization.countDocuments();
        expect(after).toBe(before);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await request(app).post('/api/auth/register').send(registerPayload());
    });

    it('logs in with correct credentials', async () => {
        const res = await request(app).post('/api/auth/login').send({
            email: 'owner@acme.test',
            password: VALID_PASSWORD,
        });
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('owner@acme.test');
    });

    it('rejects an incorrect password without leaking whether the email exists', async () => {
        const wrongPassword = await request(app).post('/api/auth/login').send({
            email: 'owner@acme.test',
            password: WRONG_PASSWORD,
        });
        const unknownEmail = await request(app).post('/api/auth/login').send({
            email: 'nobody@acme.test',
            password: WRONG_PASSWORD,
        });
        expect(wrongPassword.status).toBe(401);
        expect(unknownEmail.status).toBe(401);
        expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });

    it('locks the account after repeated failed attempts, with the same generic message', async () => {
        for (let i = 0; i < 5; i++) {
            await request(app).post('/api/auth/login').send({ email: 'owner@acme.test', password: WRONG_PASSWORD });
        }

        // 6th attempt, even with the CORRECT password, should now be rejected — locked.
        const res = await request(app).post('/api/auth/login').send({
            email: 'owner@acme.test',
            password: VALID_PASSWORD,
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password');
    });
});

describe('GET /api/auth/me', () => {
    it('rejects requests with no auth cookie', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns the current user for a valid session', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(registerPayload());

        const res = await agent.get('/api/auth/me');
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('owner@acme.test');
    });
});

describe('POST /api/auth/change-password', () => {
    it('invalidates previously issued tokens (JWT revocation via tokenVersion)', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(registerPayload());

        // Simulate a second, already-issued session by minting a token with the
        // user's pre-change tokenVersion directly.
        const user = await User.findOne({ email: 'owner@acme.test' });
        const jwt = (await import('jsonwebtoken')).default;
        const staleToken = jwt.sign({ sub: user._id.toString(), tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

        const changeRes = await agent.post('/api/auth/change-password').send({
            currentPassword: VALID_PASSWORD,
            newPassword: 'a-brand-new-password-1',
        });
        expect(changeRes.status).toBe(200);

        // The stale token (signed with the old tokenVersion) must now be rejected.
        const staleRes = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `docyra_token=${staleToken}`);
        expect(staleRes.status).toBe(401);

        // The agent's own cookie jar was refreshed by change-password and still works.
        const freshRes = await agent.get('/api/auth/me');
        expect(freshRes.status).toBe(200);
    });

    it('rejects the wrong current password', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/register').send(registerPayload());

        const res = await agent.post('/api/auth/change-password').send({
            currentPassword: WRONG_PASSWORD,
            newPassword: 'a-brand-new-password-1',
        });
        expect(res.status).toBe(401);
    });
});
