const config = require('../config/env');
const { normalizePhoneNumber } = require('../utils/phoneNormalizer');

const ipRequests = new Map();
const phoneRequests = new Map();

// Periodic cleanup every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    const windowMs = config.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

    for (const [ip, data] of ipRequests.entries()) {
        data.timestamps = data.timestamps.filter(ts => now - ts < windowMs);
        if (data.timestamps.length === 0) ipRequests.delete(ip);
    }

    for (const [phone, data] of phoneRequests.entries()) {
        data.timestamps = data.timestamps.filter(ts => now - ts < windowMs);
        if (data.timestamps.length === 0) phoneRequests.delete(phone);
    }
}, 5 * 60 * 1000);

function rateLimitOtpRequest(req, res, next) {
    const now = Date.now();
    const windowMs = config.OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    // 1. Check IP rate limit
    if (!ipRequests.has(ip)) {
        ipRequests.set(ip, { timestamps: [] });
    }
    const ipData = ipRequests.get(ip);
    ipData.timestamps = ipData.timestamps.filter(ts => now - ts < windowMs);

    if (ipData.timestamps.length >= config.OTP_RATE_LIMIT_MAX_PER_IP) {
        return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED_IP',
            message: `Terlalu banyak permintaan dari IP ini. Silakan coba lagi dalam beberapa menit.`
        });
    }

    // 2. Check Phone rate limit if phone is in body
    const rawPhone = req.body.phone || req.body.phoneNumber;
    if (rawPhone) {
        const normalized = normalizePhoneNumber(rawPhone);
        if (normalized) {
            if (!phoneRequests.has(normalized)) {
                phoneRequests.set(normalized, { timestamps: [] });
            }
            const phoneData = phoneRequests.get(normalized);
            phoneData.timestamps = phoneData.timestamps.filter(ts => now - ts < windowMs);

            if (phoneData.timestamps.length >= config.OTP_RATE_LIMIT_MAX_PER_PHONE) {
                return res.status(429).json({
                    success: false,
                    error: 'RATE_LIMIT_EXCEEDED_PHONE',
                    message: `Batas permintaan OTP untuk nomor ini telah tercapai. Silakan coba lagi nanti.`
                });
            }

            phoneData.timestamps.push(now);
        }
    }

    ipData.timestamps.push(now);
    next();
}

function resetRateLimits() {
    ipRequests.clear();
    phoneRequests.clear();
}

module.exports = {
    rateLimitOtpRequest,
    resetRateLimits
};
