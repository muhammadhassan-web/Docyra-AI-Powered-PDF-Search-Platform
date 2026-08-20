import { randomInt } from 'crypto';

// The org's shared "ask HR/IT" login isn't a real inbox — it just needs to be
// unique per org (User.email has a unique index) and never collide with a
// real person's email a company might also register. Keyed by companyCode
// (guaranteed unique, unlike a name-derived slug).
export function employeeAccountEmail(companyCode) {
    return `employee-access+${companyCode}@docyra.internal`;
}

const WORDS = [
    'amber', 'birch', 'cedar', 'coral', 'delta', 'ember', 'flint', 'grove',
    'haven', 'ivory', 'jade', 'karst', 'lumen', 'maple', 'nova', 'onyx',
    'pearl', 'quartz', 'ridge', 'slate', 'terra', 'umber', 'violet', 'willow',
];

// Generates something a person can actually read off a screen and type on a
// phone (word-number-word) rather than a dense random string — this password
// is meant to be shared verbally/over chat with every employee at a company.
// ~29 bits of entropy (24 * 24 * 900,000 combinations) — a 6-digit number
// rather than 4, since this is a single company-wide credential worth
// defending more than an individual's throwaway password would need.
export function generateSharedPassword() {
    const a = WORDS[randomInt(WORDS.length)];
    const b = WORDS[randomInt(WORDS.length)];
    const n = randomInt(100000, 1000000);
    return `${a}-${n}-${b}`;
}
