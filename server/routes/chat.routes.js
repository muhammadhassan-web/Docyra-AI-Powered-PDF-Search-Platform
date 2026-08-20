import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Policy from '../models/Policy.js';
import { requireAuth } from '../middleware/auth.js';
import { answerFromPolicies, verifyCitation } from '../utils/gemini.js';
import { retrieveContext } from '../utils/retrieval.js';

const router = Router();

const chatSchema = z.object({ message: z.string().min(1).max(1000) });

// Keyed by org (not IP) so cost-abuse can't be spread across a NAT/VPN, and a
// user rotating source IPs can't bypass the limit. In-memory today — swap the
// `store` option for a Redis-backed store (rate-limit-redis) once running
// more than one server instance, or this limit stops being meaningful.
const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.organizationId || req.ip),
    message: { error: 'Too many questions in a short time. Please wait a bit and try again.' },
});

router.post('/', requireAuth, chatLimiter, async (req, res, next) => {
    try {
        const { message } = chatSchema.parse(req.body);

        const hasAnyPolicies = await Policy.exists({ organizationId: req.user.organizationId });
        if (!hasAnyPolicies) {
            return res.json({
                answer: "There are no documents in your vault yet. Ask an admin to upload some policies first.",
                source: 'none',
                grounded: false,
            });
        }

        // Semantic retrieval (chunking + Atlas Vector Search) scoped to this
        // question, not the whole vault — see utils/retrieval.js for the
        // graceful fallback when embeddings/vector index aren't set up yet.
        const { documents } = await retrieveContext(req.user.organizationId, message);
        const result = await answerFromPolicies(message, documents);
        res.json(verifyCitation(result, documents));
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        if (err.status) return res.status(502).json({ error: 'The AI service is temporarily unavailable. Please try again.' });
        next(err);
    }
});

export default router;
