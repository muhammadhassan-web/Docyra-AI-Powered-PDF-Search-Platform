import mongoose from 'mongoose';

export const POLICY_DEPARTMENTS = ['HR', 'IT'];

const PolicySchema = new mongoose.Schema({
    name: { type: String, required: true },
    department: { type: String, enum: POLICY_DEPARTMENTS, required: true },
    lastUpdated: String,
    file_url: String,
    content: String,
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
}, { timestamps: true });

PolicySchema.index({ organizationId: 1, name: 1 }, { unique: true });
PolicySchema.index({ organizationId: 1, department: 1 });

export default mongoose.model('Policy', PolicySchema);
