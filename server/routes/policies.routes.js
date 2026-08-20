import { Router } from 'express';
import axios from 'axios';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import Policy, { POLICY_DEPARTMENTS } from '../models/Policy.js';
import Chunk from '../models/Chunk.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { orgUploadFolder } from '../utils/cloudinary.js';
import { extractPdfText } from '../utils/pdfWorkerPool.js';
import { chunkText } from '../utils/chunking.js';
import { embedDocuments } from '../utils/embeddings.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.use(requireAuth);

// Keyed by org, not IP — see chat.routes.js for the same rationale. Bounds
// PDF-fetch + parse cost, which is meaningfully expensive per request.
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user?.organizationId || req.ip),
    message: { error: 'Too many uploads in a short time. Please wait a bit and try again.' },
});

router.get('/', async (req, res, next) => {
    try {
        const policies = await Policy.find({ organizationId: req.user.organizationId }).sort({ _id: -1 }).limit(500);
        res.json(policies);
    } catch (err) {
        next(err);
    }
});

const createPolicySchema = z.object({
    file_url: z.string().url(),
    name: z.string().min(1).max(200),
    department: z.enum(POLICY_DEPARTMENTS),
    lastUpdated: z.string().min(1),
});

const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20 MB

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertTrustedCloudinaryUrl(url, organizationId) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        throw Object.assign(new Error('Invalid file URL'), { status: 400 });
    }

    // Path shape: /{cloud_name}/image/upload/v{version}/{folder}/{public_id}.{ext}
    // The folder segment must be this org's own upload folder — this is what
    // actually enforces tenant isolation (a bare res.cloudinary.com/{cloudName}
    // check is not enough: any org's admin could submit any other org's URL).
    const orgFolder = escapeRegExp(orgUploadFolder(organizationId));
    const pathPattern = new RegExp(`^/${escapeRegExp(cloudName)}/image/upload/v\\d+/${orgFolder}/`);
    const validHost = parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com';
    const validPath = validHost && pathPattern.test(parsed.pathname);
    if (!validHost || !validPath) {
        throw Object.assign(new Error('file_url must point to this workspace\'s Cloudinary uploads'), { status: 400 });
    }
}

router.post('/', requireRole('owner', 'admin'), uploadLimiter, async (req, res, next) => {
    try {
        const { file_url, name, department, lastUpdated } = createPolicySchema.parse(req.body);
        assertTrustedCloudinaryUrl(file_url, req.user.organizationId);

        let response;
        try {
            response = await axios.get(file_url, {
                responseType: 'arraybuffer',
                maxContentLength: MAX_PDF_BYTES,
                maxBodyLength: MAX_PDF_BYTES,
                timeout: 15000,
                maxRedirects: 0,
            });
        } catch {
            return res.status(400).json({ error: 'Could not download the uploaded file. Please try again.' });
        }

        let extractedText;
        try {
            // Runs in a worker thread (see utils/pdfWorkerPool.js) so parsing a
            // large/complex PDF doesn't block the event loop for other tenants'
            // requests being served by this same process.
            extractedText = await extractPdfText(response.data);
        } catch {
            return res.status(400).json({ error: 'The uploaded file could not be read as a PDF.' });
        }

        const policy = await Policy.findOneAndUpdate(
            { name, organizationId: req.user.organizationId },
            { name, department, lastUpdated, file_url, content: extractedText, organizationId: req.user.organizationId },
            { upsert: true, returnDocument: 'after' }
        );

        // Re-chunk + re-embed from scratch on every (re-)upload — simplest
        // correct behavior, and uploads are infrequent/admin-only so the cost
        // is fine. Embedding failure degrades chat to the unretrieved-context
        // fallback (see chat.routes.js) rather than failing the upload outright:
        // the document is still saved and searchable once embeddings recover.
        await Chunk.deleteMany({ policyId: policy._id });
        try {
            const pieces = chunkText(extractedText);
            if (pieces.length > 0) {
                const embeddings = await embedDocuments(pieces);
                await Chunk.insertMany(pieces.map((text, i) => ({
                    organizationId: req.user.organizationId,
                    policyId: policy._id,
                    policyName: name,
                    department,
                    chunkIndex: i,
                    text,
                    embedding: embeddings[i],
                })));
            }
        } catch (err) {
            (req.log || logger).error({ err, policyId: policy._id }, 'Failed to embed policy chunks; chat will fall back to unretrieved context for this document');
        }

        res.status(201).json({ message: 'Success' });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    }
});

router.delete('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const result = await Policy.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
        if (!result) return res.status(404).json({ error: 'Not found' });
        await Chunk.deleteMany({ policyId: result._id });
        res.status(200).json({ message: 'Deleted' });
    } catch (err) {
        next(err);
    }
});

export default router;
