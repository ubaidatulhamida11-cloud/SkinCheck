/**
 * Phone Number Normalizer & Validator according to E.164 specifications.
 */

/**
 * Normalizes an input phone string into E.164 format (+[country_code][number]).
 * Defaults to Indonesia (+62) for local 08xx or 8xx numbers.
 *
 * @param {string} rawPhone
 * @param {string} defaultCountryCode '62' by default
 * @returns {string|null} Normalized E.164 string or null if invalid
 */
function normalizePhoneNumber(rawPhone, defaultCountryCode = '62') {
    if (!rawPhone || typeof rawPhone !== 'string') {
        return null;
    }

    // Strip whitespaces, dashes, dots, parentheses
    let cleaned = rawPhone.trim().replace(/[\s\-\.\(\)]/g, '');

    if (!cleaned) return null;

    // Handle leading '+'
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    } else if (cleaned.startsWith('00')) {
        // International dialing prefix 00
        cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0')) {
        // Local zero prefix, replace with default country code
        cleaned = defaultCountryCode + cleaned.substring(1);
    } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length >= 8 && cleaned.length <= 13) {
        // E.g. user typed 81234567890 without leading 0 or +62
        cleaned = defaultCountryCode + cleaned;
    }

    // Ensure it contains only digits
    if (!/^\d+$/.test(cleaned)) {
        return null;
    }

    // E.164 total length: min 8 digits, max 15 digits (excluding '+')
    if (cleaned.length < 8 || cleaned.length > 15) {
        return null;
    }

    return '+' + cleaned;
}

/**
 * Checks if a string conforms strictly to E.164 phone format.
 * @param {string} phone
 * @returns {boolean}
 */
function isValidE164(phone) {
    if (!phone || typeof phone !== 'string') return false;
    return /^\+[1-9]\d{7,14}$/.test(phone);
}

/**
 * Masks a phone number for privacy display in views (e.g. +62 812-****-7890).
 * @param {string} phone
 * @returns {string}
 */
function maskPhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const clean = phone.trim();
    if (clean.length <= 6) return clean;
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-3);
    const maskedLength = Math.max(3, clean.length - 7);
    return `${prefix} ${'*'.repeat(maskedLength)} ${suffix}`;
}

module.exports = {
    normalizePhoneNumber,
    isValidE164,
    maskPhoneNumber
};
