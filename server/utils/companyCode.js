import Counter from '../models/Counter.js';

// Atomically increments a shared counter and returns the next zero-padded
// company code ("001", "002", ... "1000", ...). $inc is atomic at the
// MongoDB level, so concurrent registrations can never receive the same
// value — the Organization.companyCode unique index is the backstop in case
// this is ever called outside a counter-consistent path.
export async function getNextCompanyCode(session) {
    const counter = await Counter.findOneAndUpdate(
        { name: 'companyCode' },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session }
    );
    return String(counter.value).padStart(3, '0');
}
