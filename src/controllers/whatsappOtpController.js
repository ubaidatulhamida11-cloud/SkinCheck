const config = require('../config/env');
const otpService = require('../services/otpService');
const otpChallengeModel = require('../models/otpChallengeModel');
const userModel = require('../models/userModel');
const { normalizePhoneNumber, maskPhoneNumber } = require('../utils/phoneNormalizer');
const loginNotificationService = require('../services/loginNotificationService');

module.exports = {
    /**
     * POST /api/auth/whatsapp/request-otp
     */
    async requestOtp(req, res) {
        const rawPhone = req.body.phone || req.body.phoneNumber;
        const purpose = (req.body.purpose || 'login').toLowerCase();

        if (!rawPhone) {
            return res.status(400).json({
                success: false,
                error: 'PHONE_REQUIRED',
                message: 'Nomor telepon WhatsApp wajib diisi.'
            });
        }

        // Sensitive action protection: phone_link requires authenticated user
        let userId = null;
        if (purpose === 'phone_link') {
            if (!req.session || !req.session.user) {
                return res.status(401).json({
                    success: false,
                    error: 'UNAUTHORIZED',
                    message: 'Anda harus login untuk menautkan nomor WhatsApp.'
                });
            }
            userId = req.session.user.id;
        }

        try {
            const result = await otpService.requestOtp({
                rawPhone,
                purpose,
                userId
            });

            if (!result.success) {
                const statusCode = result.error === 'COOLDOWN_ACTIVE' ? 429 : 400;
                return res.status(statusCode).json(result);
            }

            const normalized = normalizePhoneNumber(rawPhone);
            return res.status(200).json({
                success: true,
                challengeId: result.challengeId,
                maskedPhone: maskPhoneNumber(normalized),
                message: result.message,
                expiresInSeconds: result.expiresInSeconds,
                resendCooldownSeconds: result.resendCooldownSeconds
            });
        } catch (error) {
            console.error('[WhatsApp OTP Controller] Request error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Terjadi kesalahan sistem saat memproses permintaan OTP.'
            });
        }
    },

    /**
     * POST /api/auth/whatsapp/resend-otp
     */
    async resendOtp(req, res) {
        const challengeId = req.body.challengeId;
        const rawPhone = req.body.phone || req.body.phoneNumber;
        const purpose = (req.body.purpose || 'login').toLowerCase();

        let targetPhone = rawPhone;
        let targetPurpose = purpose;

        if (challengeId) {
            const challenge = otpChallengeModel.getChallengeById(challengeId);
            if (challenge) {
                targetPhone = challenge.phone_number;
                targetPurpose = challenge.purpose;
            }
        }

        if (!targetPhone) {
            return res.status(400).json({
                success: false,
                error: 'PHONE_OR_CHALLENGE_REQUIRED',
                message: 'Challenge ID atau nomor telepon wajib disertakan untuk kirim ulang OTP.'
            });
        }

        let userId = null;
        if (targetPurpose === 'phone_link' && req.session && req.session.user) {
            userId = req.session.user.id;
        }

        try {
            const result = await otpService.requestOtp({
                rawPhone: targetPhone,
                purpose: targetPurpose,
                userId
            });

            if (!result.success) {
                const statusCode = result.error === 'COOLDOWN_ACTIVE' ? 429 : 400;
                return res.status(statusCode).json(result);
            }

            const normalized = normalizePhoneNumber(targetPhone);
            return res.status(200).json({
                success: true,
                challengeId: result.challengeId,
                maskedPhone: maskPhoneNumber(normalized),
                message: result.message,
                expiresInSeconds: result.expiresInSeconds,
                resendCooldownSeconds: result.resendCooldownSeconds
            });
        } catch (error) {
            console.error('[WhatsApp OTP Controller] Resend error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Terjadi kesalahan saat mengirim ulang OTP.'
            });
        }
    },

    /**
     * POST /api/auth/whatsapp/verify-otp
     */
    async verifyOtp(req, res) {
        const challengeId = req.body.challengeId;
        const otpCode = req.body.otp || req.body.otpCode || req.body.code;
        const purpose = (req.body.purpose || 'login').toLowerCase();
        const rawPhone = req.body.phone || req.body.phoneNumber;

        if (!challengeId || !otpCode) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_FIELDS',
                message: 'Challenge ID dan kode OTP wajib diisi.'
            });
        }

        try {
            const result = await otpService.verifyOtp({
                challengeId,
                otpCode,
                purpose,
                rawPhone
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            const challenge = result.challenge;

            // Handle purpose-specific success actions
            if (purpose === 'login') {
                const user = result.user;
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        error: 'USER_NOT_FOUND',
                        message: 'Nomor WhatsApp terverifikasi, namun belum terdaftar di akun SkinCheck. Silakan daftar terlebih dahulu.',
                        phone: challenge.phone_number
                    });
                }

                if (user.status === 'deleted') {
                    return res.status(403).json({
                        success: false,
                        error: 'ACCOUNT_DEACTIVATED',
                        message: 'Akun ini telah dinonaktifkan.'
                    });
                }

                // Establish authenticated session
                req.session.user = user;

                // Trigger login activity recording & WhatsApp notification asynchronously (guaranteed non-blocking)
                loginNotificationService.notifyLoginSuccess({
                    user,
                    req,
                    loginMethod: 'whatsapp_otp'
                }).catch(err => {
                    console.error('[WhatsApp OTP Login] Error in login notification:', err.message);
                });

                // Determine redirect path
                let redirectUrl = '/app/dashboard';
                if (user.role === 'admin') {
                    redirectUrl = '/admin/dashboard';
                } else if (!user.onboarding_completed) {
                    redirectUrl = '/onboarding/1';
                }

                return res.status(200).json({
                    success: true,
                    message: 'Login berhasil.',
                    redirectUrl,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            }

            if (purpose === 'phone_link') {
                if (!req.session || !req.session.user) {
                    return res.status(401).json({
                        success: false,
                        error: 'UNAUTHORIZED',
                        message: 'Sesi login telah berakhir.'
                    });
                }

                const updatedUser = userModel.updateUserPhone(
                    req.session.user.id,
                    challenge.phone_number,
                    true
                );

                if (updatedUser) {
                    req.session.user.phone_number = updatedUser.phone_number;
                    req.session.user.phone_verified = true;
                }

                return res.status(200).json({
                    success: true,
                    message: 'Nomor WhatsApp berhasil ditautkan dan diverifikasi.',
                    phoneNumber: challenge.phone_number
                });
            }

            if (purpose === 'register') {
                return res.status(200).json({
                    success: true,
                    message: 'Nomor WhatsApp berhasil diverifikasi.',
                    phoneNumber: challenge.phone_number,
                    verificationToken: challenge.id
                });
            }

            return res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            console.error('[WhatsApp OTP Controller] Verify error:', error.message);
            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Terjadi kesalahan saat memverifikasi OTP.'
            });
        }
    },

    /**
     * GET /api/auth/whatsapp/status
     */
    async getStatus(req, res) {
        const challengeId = req.query.challengeId;
        if (!challengeId) {
            return res.status(400).json({
                success: false,
                error: 'CHALLENGE_ID_REQUIRED',
                message: 'Parameter challengeId wajib disertakan.'
            });
        }

        const challenge = otpChallengeModel.getChallengeById(challengeId);
        if (!challenge) {
            return res.status(404).json({
                success: false,
                error: 'NOT_FOUND',
                message: 'Sesi OTP tidak ditemukan.'
            });
        }

        // Return sanitized status without exposing OTP hashes or salts
        return res.status(200).json({
            success: true,
            challengeId: challenge.id,
            status: challenge.status,
            deliveryStatus: challenge.delivery_status,
            expiresAt: challenge.expires_at,
            resendAvailableAt: challenge.resend_available_at,
            purpose: challenge.purpose,
            isExpired: new Date(challenge.expires_at) <= new Date(),
            maskedPhone: maskPhoneNumber(challenge.phone_number)
        });
    },

    /**
     * GET /api/auth/whatsapp/webhook (Meta verification)
     */
    handleWebhookGet(req, res) {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode && token) {
            if (mode === 'subscribe' && token === config.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
                console.log('[WhatsApp Webhook] Meta challenge verification succeeded.');
                return res.status(200).send(challenge);
            }
            console.warn('[WhatsApp Webhook] Token verification failed.');
            return res.status(403).send('Forbidden');
        }

        return res.status(400).send('Bad Request');
    },

    /**
     * POST /api/auth/whatsapp/webhook (Meta message status callbacks)
     */
    handleWebhookPost(req, res) {
        const body = req.body;

        try {
            if (body.object === 'whatsapp_business_account' && body.entry) {
                body.entry.forEach(entry => {
                    const changes = entry.changes || [];
                    changes.forEach(change => {
                        const statuses = change.value && change.value.statuses ? change.value.statuses : [];
                        statuses.forEach(st => {
                            const messageId = st.id;
                            const status = st.status; // delivered, read, failed, sent
                            if (messageId && status) {
                                const challenge = otpChallengeModel.findChallengeByProviderMessageId(messageId);
                                if (challenge) {
                                    otpChallengeModel.updateDeliveryStatus(challenge.id, status);
                                    console.log(`[WhatsApp Webhook] Updated challenge ${challenge.id} status to ${status}`);
                                }
                            }
                        });
                    });
                });
            }
        } catch (err) {
            console.error('[WhatsApp Webhook] Processing error:', err.message);
        }

        return res.status(200).json({ received: true });
    }
};
