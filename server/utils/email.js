import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Gmail SMTP with an App Password — free, no third-party signup. If unset,
// email-dependent features (password reset codes) fail with a clear error
// instead of silently pretending to send, same pattern as GEMINI_API_KEY.
let transporter;
function getTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
        });
    }
    return transporter;
}

export async function sendMail({ to, subject, text }) {
    const t = getTransporter();
    if (!t) {
        throw Object.assign(new Error('Email is not configured (EMAIL_USER/EMAIL_APP_PASSWORD missing)'), { status: 500 });
    }
    try {
        await t.sendMail({ from: `DOCYRA <${process.env.EMAIL_USER}>`, to, subject, text });
    } catch (err) {
        logger.error({ message: err.message }, 'Failed to send email');
        throw Object.assign(new Error('Could not send the email. Please try again.'), { status: 502 });
    }
}
