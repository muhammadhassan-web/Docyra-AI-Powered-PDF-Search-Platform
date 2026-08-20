import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Organization, { COMPANY_SIZES } from '../models/Organization.js';
import User from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { slugify } from '../utils/slug.js';
import { employeeAccountEmail, generateSharedPassword } from '../utils/employeeAccess.js';
import { getNextCompanyCode } from '../utils/companyCode.js';

const router = Router();

const COOKIE_NAME = 'docyra_token';
const ADMIN_TOKEN_TTL = '7d';
const EMPLOYEE_TOKEN_TTL = '24h'; // shorter — a shared credential, so limit the exposure window
const ADMIN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const EMPLOYEE_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;

function cookieOptions(user) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // 'strict' in production: this app has no cross-site linking flow that
        // needs 'lax', so there's no reason to accept the weaker default.
        // 'lax' in dev only because Vite's dev server and the API run on
        // different ports, which 'strict' would break for local testing.
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: user.isEmployeeAccount ? EMPLOYEE_COOKIE_MAX_AGE : ADMIN_COOKIE_MAX_AGE,
    };
}

function issueToken(user) {
    const expiresIn = user.isEmployeeAccount ? EMPLOYEE_TOKEN_TTL : ADMIN_TOKEN_TTL;
    return jwt.sign({ sub: user._id.toString(), tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, { expiresIn });
}

function serializeUser(user, organization) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmployeeAccount: user.isEmployeeAccount ?? false,
        organization: {
            id: organization._id,
            name: organization.name,
            slug: organization.slug,
            companyCode: organization.companyCode,
        },
    };
}

// NIST-style: length matters more than arbitrary complexity rules, but this
// is a company's admin credential, so require a minimum mix on top of length.
const strongPassword = z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(200)
    .regex(/[A-Za-z]/, 'Password must include at least one letter')
    .regex(/[0-9]/, 'Password must include at least one number');

const registerSchema = z.object({
    organizationName: z.string().min(2).max(100),
    organizationAddress: z.string().min(5).max(300),
    industry: z.string().max(100).optional(),
    companySize: z.enum(COMPANY_SIZES).optional(),
    adminName: z.string().min(2).max(100),
    email: z.string().email(),
    password: strongPassword,
});

router.post('/register', async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
        const {
            organizationName, organizationAddress, industry, companySize,
            adminName, email, password,
        } = registerSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(password, 12);
        const employeePassword = generateSharedPassword();
        const employeePasswordHash = await bcrypt.hash(employeePassword, 12);

        let organization, user;
        try {
            await session.withTransaction(async () => {
                const existing = await User.findOne({ email: email.toLowerCase() }).session(session);
                if (existing) {
                    throw Object.assign(new Error('An account with that email already exists'), { status: 409 });
                }

                // Slug uniqueness is still a check-then-act inside the transaction,
                // but the unique index on Organization.slug is the real backstop:
                // a concurrent collision surfaces as an E11000 error below rather
                // than silently creating two orgs with the same slug.
                let slug = slugify(organizationName) || 'org';
                let suffix = 0;
                while (await Organization.findOne({ slug: suffix ? `${slug}-${suffix}` : slug }).session(session)) {
                    suffix += 1;
                }
                if (suffix) slug = `${slug}-${suffix}`;

                // Sequential and atomic ($inc), then backstopped by a unique
                // index — two companies can never end up with the same code,
                // even under concurrent registrations.
                const companyCode = await getNextCompanyCode(session);

                const [org] = await Organization.create(
                    [{ name: organizationName, slug, companyCode, address: organizationAddress, industry, size: companySize }],
                    { session }
                );
                const [createdUser] = await User.create(
                    [{ name: adminName, email, passwordHash, role: 'owner', organizationId: org._id }],
                    { session }
                );
                // Every org gets one shared "ask HR/IT" login for employees —
                // see utils/employeeAccess.js. Created alongside the owner so
                // there's always something to hand out immediately after signup.
                await User.create(
                    [{
                        email: employeeAccountEmail(companyCode),
                        passwordHash: employeePasswordHash,
                        role: 'member',
                        organizationId: org._id,
                        isEmployeeAccount: true,
                    }],
                    { session }
                );
                organization = org;
                user = createdUser;
            });
        } catch (txErr) {
            if (txErr.status) return res.status(txErr.status).json({ error: txErr.message });
            if (txErr.code === 11000) {
                return res.status(409).json({ error: 'That email or organization name is already taken. Please try again.' });
            }
            throw txErr;
        }

        const token = issueToken(user);
        res.cookie(COOKIE_NAME, token, cookieOptions(user));
        res.status(201).json({
            user: serializeUser(user, organization),
            employeeAccess: { companyCode: organization.companyCode, password: employeePassword },
        });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    } finally {
        await session.endSession();
    }
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        // Same generic message for "no such account", "wrong password", and
        // "locked out" — distinguishing any of them would tell an attacker
        // that the email exists, which is exactly what this is meant to hide.
        const reject = () => res.status(401).json({ error: 'Invalid email or password' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return reject();

        // Per-account lockout, on top of the router-wide IP rate limiter —
        // the limiter alone doesn't stop a credential-stuffing attack spread
        // across many IPs against one specific known email.
        if (user.lockedUntil && user.lockedUntil > new Date()) return reject();

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
                user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
                user.failedLoginAttempts = 0;
            }
            await user.save();
            return reject();
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            user.failedLoginAttempts = 0;
            user.lockedUntil = undefined;
            await user.save();
        }

        const organization = await Organization.findById(user.organizationId);

        const token = issueToken(user);
        res.cookie(COOKIE_NAME, token, cookieOptions(user));
        res.json({ user: serializeUser(user, organization) });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    }
});

const employeeLoginSchema = z.object({
    companyCode: z.string().min(1),
    password: z.string().min(1),
});

// The shared employee password has less entropy than a normal user password
// by design (it's meant to be spoken/typed by hand) — key rate limiting by
// the company code being attacked, on top of the router-wide IP limiter, so
// guessing one org's password can't be parallelized across many IPs either.
// (No per-account lockout here, deliberately: locking the one shared account
// would let anyone DoS an entire company's employee access at will.)
const employeeLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.EMPLOYEE_LOGIN_RATE_LIMIT) || 15,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.body?.companyCode || req.ip),
    message: { error: 'Too many attempts. Please wait a bit and try again.' },
});

router.post('/employee-login', employeeLoginLimiter, async (req, res, next) => {
    try {
        const { companyCode, password } = employeeLoginSchema.parse(req.body);

        const organization = await Organization.findOne({ companyCode: companyCode.trim() });
        if (!organization) return res.status(401).json({ error: 'Invalid company code or password' });

        const user = await User.findOne({ organizationId: organization._id, isEmployeeAccount: true });
        if (!user) return res.status(401).json({ error: 'Invalid company code or password' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid company code or password' });

        const token = issueToken(user);
        res.cookie(COOKIE_NAME, token, cookieOptions(user));
        res.json({ user: serializeUser(user, organization) });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    }
});

// Owner/admin only: rotate the shared employee password. Returns the new
// plaintext password exactly once — like the initial one from /register, it
// is never stored or retrievable again after this response.
router.post('/employee-access/regenerate', requireAuth, requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const password = generateSharedPassword();
        const passwordHash = await bcrypt.hash(password, 12);

        let employeeUser = await User.findOne({ organizationId: req.user.organizationId, isEmployeeAccount: true });
        if (employeeUser) {
            employeeUser.passwordHash = passwordHash;
            // Rotating the password should also end any already-logged-in
            // employee sessions using the old one, same as a normal password change.
            employeeUser.tokenVersion += 1;
            await employeeUser.save();
        } else {
            // Backstop for orgs created before this feature existed.
            const organization = await Organization.findById(req.user.organizationId);
            employeeUser = await User.create({
                email: employeeAccountEmail(organization.companyCode),
                passwordHash,
                role: 'member',
                organizationId: req.user.organizationId,
                isEmployeeAccount: true,
            });
        }

        res.json({ password });
    } catch (err) {
        next(err);
    }
});

router.get('/employee-access', requireAuth, requireRole('owner', 'admin'), async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        const exists = await User.exists({ organizationId: req.user.organizationId, isEmployeeAccount: true });
        res.json({ companyCode: organization.companyCode, isSetUp: Boolean(exists) });
    } catch (err) {
        next(err);
    }
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: strongPassword,
});

router.post('/change-password', requireAuth, async (req, res, next) => {
    try {
        // The shared employee login isn't owned by any one person — letting
        // whoever's logged in change it would let one employee lock out the
        // rest of the company. Only owner/admin can rotate it, via
        // /employee-access/regenerate.
        if (req.user.isEmployeeAccount) {
            return res.status(403).json({ error: 'The shared employee login can only be reset by an admin.' });
        }

        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

        const user = await User.findById(req.user._id);
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        user.passwordHash = await bcrypt.hash(newPassword, 12);
        // Invalidates every other JWT already issued for this user (other
        // devices/sessions get logged out; only this response's fresh cookie works).
        user.tokenVersion += 1;
        await user.save();

        const token = issueToken(user);
        res.cookie(COOKIE_NAME, token, cookieOptions(user));
        res.json({ message: 'Password updated' });
    } catch (err) {
        if (err.name === 'ZodError') return res.status(400).json({ error: err.issues[0]?.message || 'Invalid input' });
        next(err);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    });
    res.status(200).json({ message: 'Logged out' });
});

router.get('/me', requireAuth, async (req, res, next) => {
    try {
        const organization = await Organization.findById(req.user.organizationId);
        res.json({ user: serializeUser(req.user, organization) });
    } catch (err) {
        next(err);
    }
});

export default router;
