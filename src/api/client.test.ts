import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from './client';

describe('api client', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns parsed JSON on success', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ hello: 'world' }),
        }));

        const data = await api.get<{ hello: string }>('/api/anything');
        expect(data).toEqual({ hello: 'world' });
    });

    it('throws an ApiError with the server message on failure', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: 'Not authenticated' }),
        }));

        await expect(api.get('/api/policies')).rejects.toMatchObject(
            new ApiError('Not authenticated', 401)
        );
    });

    it('falls back to a generic message when the error body has no error field', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error('no body')),
        }));

        await expect(api.get('/api/policies')).rejects.toThrow('Request failed (500)');
    });

    it('sends credentials and JSON content-type on POST with a body', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ ok: true }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await api.post('/api/auth/login', { email: 'a@b.com' });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/login'),
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
                headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ email: 'a@b.com' }),
            })
        );
    });
});
