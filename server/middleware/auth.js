import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
    try {
        const token = req.cookies?.docyra_token;
        if (!token) return res.status(401).json({ error: 'Not authenticated' });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.sub).select('-passwordHash');
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        // Reject tokens issued before the user's last password change / revocation.
        if (payload.tv !== user.tokenVersion) return res.status(401).json({ error: 'Not authenticated' });

        req.user = user;
        next();
    } catch {
        return res.status(401).json({ error: 'Not authenticated' });
    }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
