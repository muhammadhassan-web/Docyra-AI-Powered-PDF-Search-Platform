import { Router } from 'express';
import { z } from 'zod';
import Organization, { COMPANY_SIZES } from '../models/Organization.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const updateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    address: z.string().min(5).max(300).optional(),
    industry: z.string().max(100).optional(),
    size: z.enum(COMPANY_SIZES).optional(),
});

router.get('/', requireAuth, requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        res.json({
            name: organization.name,
            address: organization.address,
            industry: organization.industry || '',
            size: organization.size || '',
            companyCode: organization.companyCode,
        });
    } catch (err) {
        next(err);
    }
});

router.patch('/', requireAuth, requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const updates = updateSchema.parse(req.body);
        const organization = await Organization.findByIdAndUpdate(
            req.user.organizationId,
            { $set: updates },
            { new: true, runValidators: true }
        );
        res.json({
            name: organization.name,
            address: organization.address,
            industry: organization.industry || '',
            size: organization.size || '',
            companyCode: organization.companyCode,
        });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    }
});

export default router;
