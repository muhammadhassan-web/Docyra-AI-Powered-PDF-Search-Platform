import { logger } from './logger.js';

// Resend's HTTP API — SMTP is blocked outbound on Render's free tier
// (confirmed: both port 465 and 587 connections time out there), so this
// sends over plain HTTPS instead, which isn't blocked. Free tier, no
// domain verification required to start (uses Resend's shared sender).
const RESEND_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = process.env.RESEND_FROM || 'DOCYRA <onboarding@resend.dev>';

export async function sendMail({ to, subject, text }) {
    if (!process.env.RESEND_API_KEY) {
        throw Object.assign(new Error('Email is not configured (RESEND_API_KEY missing)'), { status: 500 });
    }

    let response;
    try {
        response = await fetch(RESEND_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, text }),
            signal: AbortSignal.timeout(10000),
        });
    } catch (err) {
        logger.error({ message: err.message }, 'Failed to reach Resend API');
        throw Object.assign(new Error('Could not send the email. Please try again.'), { status: 502 });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        logger.error({ status: response.status, body }, 'Resend API rejected the email');
        throw Object.assign(new Error('Could not send the email. Please try again.'), { status: 502 });
    }
}
