import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    // Not set on the shared employee account — it belongs to the org, not a person.
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    // Bumped on password change (and available for a future "sign out everywhere"
    // action) to invalidate previously issued JWTs — see requireAuth.
    tokenVersion: { type: Number, default: 0 },
    // Marks the single shared login every employee at this org uses to reach
    // chat (see routes/auth.routes.js employee-login / employee-access) — not
    // a real inbox. At most one per organization.
    isEmployeeAccount: { type: Boolean, default: false },
    // Per-account brute-force lockout (in addition to IP-based rate limiting,
    // which alone doesn't stop a distributed attack against one known email).
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    // Email-verification code for password recovery — always tied to the
    // account whose *own* registered email address received it (see
    // POST /forgot-password and /employee-access/request-reset-code).
    resetCodeHash: { type: String, select: false },
    resetCodeExpiresAt: { type: Date, select: false },
}, { timestamps: true });

// Partial index: enforce at most one shared employee account per org without
// constraining the (many) normal per-person accounts that also share an org.
UserSchema.index(
    { organizationId: 1 },
    { unique: true, partialFilterExpression: { isEmployeeAccount: true } }
);

export default mongoose.model('User', UserSchema);
