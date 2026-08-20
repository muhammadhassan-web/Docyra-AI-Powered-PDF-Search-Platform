import mongoose from 'mongoose';

// One row per retrievable slice of a Policy document. Kept separate from
// Policy (rather than an embedded array) so Atlas Vector Search can index
// `embedding` directly and so re-chunking a policy on re-upload is a cheap
// delete-and-replace rather than an update to a large parent document.
const ChunkSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    policyName: { type: String, required: true },
    department: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
}, { timestamps: true });

ChunkSchema.index({ organizationId: 1, policyId: 1 });

export default mongoose.model('Chunk', ChunkSchema);
