import mongoose from 'mongoose';

// Backs atomic sequence generation (see utils/companyCode.js). One document
// per named sequence — currently just 'companyCode'.
const CounterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 },
});

export default mongoose.model('Counter', CounterSchema);
