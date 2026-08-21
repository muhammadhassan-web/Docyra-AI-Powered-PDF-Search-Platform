import { logger } from './logger.js';

// Brevo's HTTP API — SMTP is blocked outbound on Render's free tier
// (confirmed: both port 465 and 587 connections to Gmail time out there),
// so this sends over plain HTTPS instead, which isn't blocked. Unlike
// Resend, Brevo lets a single *verified sender email* (not a whole domain)
// send to any recipient on the free tier — no domain ownership required.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendMail({ to, subject, text }) {
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
        throw Object.assign(new Error('Email is not configured (BREVO_API_KEY/BREVO_SENDER_EMAIL missing)'), { status: 500 });
    }

    let response;
    try {
        response = await fetch(BREVO_URL, {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'DOCYRA' },
                to: [{ email: to }],
                subject,
                textContent: text,
            }),
            signal: AbortSignal.timeout(10000),
        });
    } catch (err) {
        logger.error({ message: err.message }, 'Failed to reach Brevo API');
        throw Object.assign(new Error('Could not send the email. Please try again.'), { status: 502 });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error({ status: response.status, body }, 'Brevo API rejected the email');
        throw Object.assign(new Error('Could not send the email. Please try again.'), { status: 502 });
    }
}
