import mongoose from 'mongoose';

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // Sequential, guaranteed-unique employee-facing login code ("001", "002",
    // ...) — see utils/companyCode.js. Deliberately not derived from the
    // company name so two companies can never collide or be confused.
    companyCode: { type: String, required: true, unique: true, index: true },
    address: { type: String, required: true, trim: true },
    industry: { type: String, trim: true },
    size: { type: String, enum: COMPANY_SIZES },
}, { timestamps: true });

export default mongoose.model('Organization', OrganizationSchema);
