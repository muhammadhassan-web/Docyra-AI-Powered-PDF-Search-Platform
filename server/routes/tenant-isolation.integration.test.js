import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { startTestDB, stopTestDB, clearTestDB } from '../test/db.js';

vi.mock('axios', () => ({
    default: { get: vi.fn(async () => ({ data: Buffer.from('fake-pdf-bytes') })) },
}));
vi.mock('../utils/pdfWorkerPool.js', () => ({
    extractPdfText: vi.fn(async () => 'This is the extracted policy text about vacation days.'),
}));
// Real embeddings need a live Gemini call — these tests only exercise the
// upload/chat pipeline shape, so stub embeddings out entirely rather than
// letting them fail against the incomplete axios mock above (axios.get is
// mocked for the Cloudinary download; embeddings needs axios.post).
vi.mock('../utils/embeddings.js', () => ({
    embedDocuments: vi.fn(async (texts) => texts.map(() => Array(768).fill(0.01))),
    embedQuery: vi.fn(async () => Array(768).fill(0.01)),
}));
vi.mock('../utils/gemini.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        answerFromPolicies: vi.fn(async (question, policies) => ({
            answer: `Mock answer using ${policies.length} document(s).`,
            source: policies[0]?.name || 'none',
            grounded: policies.length > 0,
        })),
    };
});

const { createApp } = await import('../app.js');
const app = createApp();

beforeAll(async () => {
    await startTestDB();
}, 60000);

afterAll(async () => {
    await stopTestDB();
});

beforeEach(async () => {
    await clearTestDB();
    vi.clearAllMocks();
});

async function registerOrg(agent, { organizationName, email, password = 'correct-horse-9' }) {
    const res = await agent.post('/api/auth/register').send({
        organizationName,
        organizationAddress: '123 Main St, Springfield',
        adminName: 'Test Owner',
        email,
        password,
        employeePassword: 'team-password-1',
    });
    return res.body.user;
}

function cloudinaryUrlFor(organizationId, filename = 'handbook.pdf') {
    return `https://res.cloudinary.com/docyra-demo/image/upload/v1/docyra_vault/${organizationId}/${filename}`;
}

describe('Tenant isolation', () => {
    it('an org cannot see another org\'s policies via GET /api/policies', async () => {
        const agentA = request.agent(app);
        const userA = await registerOrg(agentA, { organizationName: 'Org A', email: 'owner-a@test.com' });
        await agentA.post('/api/policies').send({
            file_url: cloudinaryUrlFor(userA.organization.id),
            name: 'Org A Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });

        const agentB = request.agent(app);
        await registerOrg(agentB, { organizationName: 'Org B', email: 'owner-b@test.com' });

        const res = await agentB.get('/api/policies');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('an org cannot delete another org\'s policy by guessing its id', async () => {
        const agentA = request.agent(app);
        const userA = await registerOrg(agentA, { organizationName: 'Org A', email: 'owner-a@test.com' });
        await agentA.post('/api/policies').send({
            file_url: cloudinaryUrlFor(userA.organization.id),
            name: 'Org A Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        const [policy] = (await agentA.get('/api/policies')).body;

        const agentB = request.agent(app);
        await registerOrg(agentB, { organizationName: 'Org B', email: 'owner-b@test.com' });

        const deleteRes = await agentB.delete(`/api/policies/${policy._id}`);
        expect(deleteRes.status).toBe(404);

        const stillThere = await agentA.get('/api/policies');
        expect(stillThere.body).toHaveLength(1);
    });

    it('rejects a policy upload whose file_url points at another org\'s Cloudinary folder', async () => {
        const agentA = request.agent(app);
        const userA = await registerOrg(agentA, { organizationName: 'Org A', email: 'owner-a@test.com' });

        const agentB = request.agent(app);
        const userB = await registerOrg(agentB, { organizationName: 'Org B', email: 'owner-b@test.com' });

        // Org A's admin tries to ingest a URL that lives under Org B's folder.
        const res = await agentA.post('/api/policies').send({
            file_url: cloudinaryUrlFor(userB.organization.id),
            name: 'Smuggled Doc',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });

        expect(res.status).toBe(400);
        void userA;
    });

    it('chat only answers from the requesting org\'s own documents', async () => {
        const agentA = request.agent(app);
        const userA = await registerOrg(agentA, { organizationName: 'Org A', email: 'owner-a@test.com' });
        await agentA.post('/api/policies').send({
            file_url: cloudinaryUrlFor(userA.organization.id),
            name: 'Org A Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });

        const agentB = request.agent(app);
        await registerOrg(agentB, { organizationName: 'Org B', email: 'owner-b@test.com' });

        const chatB = await agentB.post('/api/chat').send({ message: 'What is the vacation policy?' });
        expect(chatB.status).toBe(200);
        expect(chatB.body.grounded).toBe(false);
        expect(chatB.body.answer).toMatch(/no documents/i);

        const chatA = await agentA.post('/api/chat').send({ message: 'What is the vacation policy?' });
        expect(chatA.status).toBe(200);
        expect(chatA.body.grounded).toBe(true);
        expect(chatA.body.source).toBe('Org A Handbook');
    });
});

describe('Role-based authorization', () => {
    async function registerMember(ownerAgent, organizationId, email) {
        // No invite flow exists yet, so create the member directly in the DB
        // (mirrors what an invite endpoint would eventually do) and log in.
        const bcrypt = (await import('bcryptjs')).default;
        const User = (await import('../models/User.js')).default;
        const passwordHash = await bcrypt.hash('member-password-1', 12);
        await User.create({ email, passwordHash, role: 'member', organizationId });

        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ email, password: 'member-password-1' });
        return agent;
    }

    it('a member cannot upload a policy', async () => {
        const ownerAgent = request.agent(app);
        const owner = await registerOrg(ownerAgent, { organizationName: 'Org A', email: 'owner-a@test.com' });
        const memberAgent = await registerMember(ownerAgent, owner.organization.id, 'member-a@test.com');

        const res = await memberAgent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id),
            name: 'Should Not Upload',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        expect(res.status).toBe(403);
    });

    it('a member cannot delete a policy', async () => {
        const ownerAgent = request.agent(app);
        const owner = await registerOrg(ownerAgent, { organizationName: 'Org A', email: 'owner-a@test.com' });
        await ownerAgent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id),
            name: 'Org A Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        const [policy] = (await ownerAgent.get('/api/policies')).body;

        const memberAgent = await registerMember(ownerAgent, owner.organization.id, 'member-a@test.com');
        const res = await memberAgent.delete(`/api/policies/${policy._id}`);
        expect(res.status).toBe(403);
    });

    it('a member can still read policies and use chat', async () => {
        const ownerAgent = request.agent(app);
        const owner = await registerOrg(ownerAgent, { organizationName: 'Org A', email: 'owner-a@test.com' });
        await ownerAgent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id),
            name: 'Org A Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });

        const memberAgent = await registerMember(ownerAgent, owner.organization.id, 'member-a@test.com');
        const listRes = await memberAgent.get('/api/policies');
        expect(listRes.status).toBe(200);
        expect(listRes.body).toHaveLength(1);

        const chatRes = await memberAgent.post('/api/chat').send({ message: 'What is the vacation policy?' });
        expect(chatRes.status).toBe(200);
        expect(chatRes.body.grounded).toBe(true);
    });

    it('an admin can upload and delete like an owner', async () => {
        const ownerAgent = request.agent(app);
        const owner = await registerOrg(ownerAgent, { organizationName: 'Org A', email: 'owner-a@test.com' });

        const bcrypt = (await import('bcryptjs')).default;
        const User = (await import('../models/User.js')).default;
        const passwordHash = await bcrypt.hash('admin-password-1', 12);
        await User.create({ email: 'admin-a@test.com', passwordHash, role: 'admin', organizationId: owner.organization.id });
        const adminAgent = request.agent(app);
        await adminAgent.post('/api/auth/login').send({ email: 'admin-a@test.com', password: 'admin-password-1' });

        const uploadRes = await adminAgent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id),
            name: 'Admin Uploaded Doc',
            department: 'IT',
            lastUpdated: '2026-01-01',
        });
        expect(uploadRes.status).toBe(201);

        const [policy] = (await adminAgent.get('/api/policies')).body;
        const deleteRes = await adminAgent.delete(`/api/policies/${policy._id}`);
        expect(deleteRes.status).toBe(200);
    });
});

describe('Full upload -> chat pipeline', () => {
    it('an uploaded PDF becomes queryable via chat with a matching citation', async () => {
        const agent = request.agent(app);
        const owner = await registerOrg(agent, { organizationName: 'Acme', email: 'owner@acme.test' });

        const uploadRes = await agent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id, 'benefits.pdf'),
            name: 'Benefits Handbook',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        expect(uploadRes.status).toBe(201);

        const chatRes = await agent.post('/api/chat').send({ message: 'How many vacation days do I get?' });
        expect(chatRes.status).toBe(200);
        expect(chatRes.body.grounded).toBe(true);
        expect(chatRes.body.source).toBe('Benefits Handbook');
    });

    it('rejects a non-PDF file gracefully when parsing fails', async () => {
        const { extractPdfText } = await import('../utils/pdfWorkerPool.js');
        extractPdfText.mockRejectedValueOnce(Object.assign(new Error('Invalid PDF structure'), { status: 400 }));

        const agent = request.agent(app);
        const owner = await registerOrg(agent, { organizationName: 'Acme', email: 'owner@acme.test' });

        const res = await agent.post('/api/policies').send({
            file_url: cloudinaryUrlFor(owner.organization.id, 'not-a-pdf.pdf'),
            name: 'Bad File',
            department: 'HR',
            lastUpdated: '2026-01-01',
        });
        expect(res.status).toBe(400);
    });
});
