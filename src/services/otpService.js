const crypto = require('crypto');
const config = require('../config/env');
const otpChallengeModel = require('../models/otpChallengeModel');
const userModel = require('../models/userModel');
const { normalizePhoneNumber } = require('../utils/phoneNormalizer');
const { getProvider } = require('./whatsapp');

class OtpService {
    /**
     * Generates a 6-digit cryptographically secure numeric OTP.
     * @returns {string} 6-digit string
     */
    generateSecureOtp() {
        return crypto.randomInt(100000, 1000000).toString();
    }

    /**
     * Computes a keyed HMAC-SHA256 hash of the OTP bound to phone & purpose.
     */
    hashOtp(otpCode, salt, phoneNumber, purpose) {
        const payload = `${salt}:${otpCode}:${purpose}:${phoneNumber}`;
        return crypto.createHmac('sha256', config.OTP_SECRET_KEY)
            .update(payload)
            .digest('hex');
    }

    /**
     * Verifies the OTP hash using constant-time comparison to prevent timing attacks.
     */
    verifyOtpHash(inputOtp, challenge) {
        if (!inputOtp || !challenge || !challenge.otp_hash) return false;

        const expectedHash = this.hashOtp(
            inputOtp.trim(),
            challenge.salt,
            challenge.phone_number,
            challenge.purpose
        );

        const bufA = Buffer.from(expectedHash, 'hex');
        const bufB = Buffer.from(challenge.otp_hash, 'hex');

        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    }

    /**
     * Initiates an OTP request: validates cooldown, generates code, saves challenge,
     * dispatches via WhatsApp provider, and updates delivery status.
     *
     * @param {Object} params
     * @param {string} params.rawPhone
     * @param {string} [params.purpose='login'] 'login' | 'register' | 'phone_link'
     * @param {string} [params.userId=null]
     * @returns {Promise<{success: boolean, challengeId?: string, message: string, cooldownSeconds?: number, error?: string}>}
     */
    async requestOtp({ rawPhone, purpose = 'login', userId = null }) {
        const normalizedPhone = normalizePhoneNumber(rawPhone);
        if (!normalizedPhone) {
            return {
                success: false,
                error: 'INVALID_PHONE_NUMBER',
                message: 'Format nomor telepon tidak valid. Gunakan format internasional (contoh: +628123456789 atau 08123456789).'
            };
        }

        // Validate purpose
        const validPurposes = ['login', 'register', 'phone_link'];
        if (!validPurposes.includes(purpose)) {
            return {
                success: false,
                error: 'INVALID_PURPOSE',
                message: 'Tujuan autentikasi tidak valid.'
            };
        }

        // Check active challenge cooldown
        const existingChallenge = otpChallengeModel.findActiveByPhoneAndPurpose(normalizedPhone, purpose);
        const now = new Date();

        if (existingChallenge && new Date(existingChallenge.resend_available_at) > now) {
            const remainingCooldown = Math.ceil((new Date(existingChallenge.resend_available_at) - now) / 1000);
            return {
                success: false,
                error: 'COOLDOWN_ACTIVE',
                message: `Mohon tunggu ${remainingCooldown} detik sebelum meminta kode OTP baru.`,
                cooldownSeconds: remainingCooldown,
                challengeId: existingChallenge.id
            };
        }

        // Generate OTP & Salt
        const otpCode = this.generateSecureOtp();
        const salt = crypto.randomBytes(16).toString('hex');
        const otpHash = this.hashOtp(otpCode, salt, normalizedPhone, purpose);

        // If user not provided, try to find user by phone (for login)
        let resolvedUserId = userId;
        if (!resolvedUserId && purpose === 'login') {
            const existingUser = userModel.getUserByPhone(normalizedPhone);
            if (existingUser) {
                resolvedUserId = existingUser.id;
            }
        }

        let otpSettings = null;
        try {
            const systemConfigModel = require('../models/systemConfigModel');
            otpSettings = systemConfigModel.getOtpSettings();
        } catch (e) {}

        const activeExpiration = otpSettings?.expiration_seconds || config.OTP_EXPIRATION_SECONDS;
        const activeCooldown = otpSettings?.resend_cooldown_seconds || config.OTP_RESEND_COOLDOWN_SECONDS;
        const activeMaxAttempts = otpSettings?.max_attempts || config.OTP_MAX_ATTEMPTS;

        // Create challenge in database
        const challenge = otpChallengeModel.createChallenge({
            userId: resolvedUserId,
            phoneNumber: normalizedPhone,
            purpose,
            otpHash,
            salt,
            expiresInSeconds: activeExpiration,
            resendCooldownSeconds: activeCooldown,
            maxAttempts: activeMaxAttempts,
            deliveryStatus: 'pending'
        });

        // Dispatch via WhatsApp Provider
        const provider = getProvider();
        const dispatchResult = await provider.sendOtpMessage({
            to: normalizedPhone,
            otpCode,
            templateName: config.WHATSAPP_TEMPLATE_NAME,
            templateLang: config.WHATSAPP_TEMPLATE_LANG
        });

        if (!dispatchResult.success) {
            // Update challenge status to failed delivery
            otpChallengeModel.updateDeliveryStatus(challenge.id, 'failed');

            return {
                success: false,
                error: dispatchResult.error || 'DISPATCH_FAILED',
                message: dispatchResult.message || 'Gagal mengirim kode verifikasi WhatsApp. Silakan coba lagi.',
                challengeId: challenge.id
            };
        }

        // Update challenge delivery status
        otpChallengeModel.updateDeliveryStatus(
            challenge.id,
            dispatchResult.deliveryStatus || 'sent',
            dispatchResult.messageId || null
        );

        return {
            success: true,
            challengeId: challenge.id,
            message: 'Jika nomor valid, kode verifikasi OTP 6-digit telah dikirimkan ke WhatsApp Anda.',
            expiresInSeconds: config.OTP_EXPIRATION_SECONDS,
            resendCooldownSeconds: config.OTP_RESEND_COOLDOWN_SECONDS
        };
    }

    /**
     * Verifies an OTP code against a challenge.
     *
     * @param {Object} params
     * @param {string} params.challengeId
     * @param {string} params.otpCode
     * @param {string} params.purpose
     * @param {string} [params.rawPhone]
     * @returns {Promise<{success: boolean, error?: string, message: string, challenge?: Object, user?: Object}>}
     */
    async verifyOtp({ challengeId, otpCode, purpose, rawPhone = null }) {
        if (!challengeId || !otpCode) {
            return {
                success: false,
                error: 'MISSING_FIELDS',
                message: 'Challenge ID dan kode OTP wajib diisi.'
            };
        }

        const challenge = otpChallengeModel.getChallengeById(challengeId);
        if (!challenge) {
            return {
                success: false,
                error: 'CHALLENGE_NOT_FOUND',
                message: 'Sesi verifikasi tidak ditemukan atau sudah kedaluwarsa.'
            };
        }

        // Validate purpose isolation
        if (challenge.purpose !== purpose) {
            return {
                success: false,
                error: 'PURPOSE_MISMATCH',
                message: 'Tujuan verifikasi tidak sesuai dengan sesi OTP yang diminta.'
            };
        }

        // Validate phone binding if provided
        if (rawPhone) {
            const normalized = normalizePhoneNumber(rawPhone);
            if (normalized && normalized !== challenge.phone_number) {
                return {
                    success: false,
                    error: 'PHONE_MISMATCH',
                    message: 'Nomor telepon tidak sesuai dengan sesi verifikasi ini.'
                };
            }
        }

        const now = new Date();

        // Check if already consumed
        if (challenge.status === 'consumed') {
            return {
                success: false,
                error: 'ALREADY_CONSUMED',
                message: 'Kode OTP ini sudah digunakan sebelumnya.'
            };
        }

        // Check expiration
        if (challenge.status === 'expired' || new Date(challenge.expires_at) <= now) {
            challenge.status = 'expired';
            return {
                success: false,
                error: 'OTP_EXPIRED',
                message: 'Kode OTP telah kedaluwarsa. Silakan minta kode baru.'
            };
        }

        // Check attempt limit
        if (challenge.status === 'failed' || challenge.failed_attempts >= challenge.max_attempts) {
            return {
                success: false,
                error: 'MAX_ATTEMPTS_EXCEEDED',
                message: 'Batas percobaan verifikasi telah tercapai. Silakan minta kode baru.'
            };
        }

        // Validate hash
        const isValid = this.verifyOtpHash(otpCode, challenge);

        if (!isValid) {
            const updated = otpChallengeModel.incrementFailedAttempts(challenge.id);
            const remainingAttempts = Math.max(0, challenge.max_attempts - updated.failed_attempts);

            if (remainingAttempts === 0) {
                return {
                    success: false,
                    error: 'MAX_ATTEMPTS_EXCEEDED',
                    message: 'Kode OTP salah. Batas percobaan habis. Silakan minta kode baru.'
                };
            }

            return {
                success: false,
                error: 'INVALID_OTP',
                message: `Kode OTP salah. Sisa percobaan: ${remainingAttempts}.`,
                remainingAttempts
            };
        }

        // Consume challenge atomically
        const consumeResult = otpChallengeModel.consumeChallenge(challenge.id);
        if (!consumeResult.success) {
            return {
                success: false,
                error: consumeResult.reason,
                message: 'Gagal memverifikasi OTP. Sesi mungkin sudah kedaluwarsa atau terpakai.'
            };
        }

        // If user_id exists or found, resolve user
        let user = null;
        if (challenge.user_id) {
            user = userModel.getUserById(challenge.user_id);
        } else {
            user = userModel.getUserByPhone(challenge.phone_number);
        }

        return {
            success: true,
            message: 'Verifikasi WhatsApp OTP berhasil.',
            challenge: consumeResult.challenge,
            user
        };
    }
}

module.exports = new OtpService();
