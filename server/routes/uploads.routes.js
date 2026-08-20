import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildSignedUploadParams } from '../utils/cloudinary.js';

const router = Router();

router.get('/signature', requireAuth, requireRole('owner', 'admin'), (req, res) => {
    res.json(buildSignedUploadParams(req.user.organizationId));
});

export default router;
