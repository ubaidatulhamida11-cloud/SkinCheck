const fs = require('fs');
const path = require('path');

// Safely load .env file if it exists
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    if (typeof process.loadEnvFile === 'function') {
        try {
            process.loadEnvFile(envPath);
        } catch (e) {
            console.warn('[Config] Could not parse .env using loadEnvFile:', e.message);
        }
    } else {
        // Fallback manual parser for Node without process.loadEnvFile
        try {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const eqIdx = trimmed.indexOf('=');
                    if (eqIdx !== -1) {
                        const key = trimmed.slice(0, eqIdx).trim();
                        let val = trimmed.slice(eqIdx + 1).trim();
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.slice(1, -1);
                        }
                        if (!process.env[key]) {
                            process.env[key] = val;
                        }
                    }
                }
            });
        } catch (err) {
            console.warn('[Config] Error loading .env:', err.message);
        }
    }
}

module.exports = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    SESSION_SECRET: process.env.SESSION_SECRET || 'skincheck-mvp-super-secret',

    // WhatsApp Provider
    WHATSAPP_PROVIDER: (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase(),
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    WHATSAPP_API_BASE_URL: process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v21.0',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
    WHATSAPP_TEMPLATE_NAME: process.env.WHATSAPP_TEMPLATE_NAME || 'skincheck_verification',
    WHATSAPP_TEMPLATE_LANG: process.env.WHATSAPP_TEMPLATE_LANG || 'id',

    // OTP Security
    OTP_SECRET_KEY: process.env.OTP_SECRET_KEY || 'skincheck-otp-default-hmac-secret-dev',
    OTP_EXPIRATION_SECONDS: parseInt(process.env.OTP_EXPIRATION_SECONDS || '300', 10),
    OTP_RESEND_COOLDOWN_SECONDS: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
    OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),

    // Rate Limiting
    OTP_RATE_LIMIT_WINDOW_MINUTES: parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || '15', 10),
    OTP_RATE_LIMIT_MAX_PER_PHONE: parseInt(process.env.OTP_RATE_LIMIT_MAX_PER_PHONE || '5', 10),
    OTP_RATE_LIMIT_MAX_PER_IP: parseInt(process.env.OTP_RATE_LIMIT_MAX_PER_IP || '10', 10)
};
