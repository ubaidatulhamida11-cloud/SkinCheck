const userModel = require('../models/userModel');
const otpService = require('../services/otpService');
const { getProvider } = require('../services/whatsapp');
const { normalizePhoneNumber, maskPhoneNumber } = require('../utils/phoneNormalizer');
const loginNotificationService = require('../services/loginNotificationService');
const config = require('../config/env');

module.exports = {
    showRegister(req, res) {
        res.render('auth/register', { error: null, formData: {} });
    },

    async register(req, res) {
        const { name, email, password, confirmPassword, privacyConsent, dataConsent, phoneNumber } = req.body;
        const formData = { name, email, phoneNumber };

        if (!name || !email || !password || !confirmPassword || !phoneNumber) {
            return res.render('auth/register', { 
                error: 'Semua kolom formulir termasuk Nomor WhatsApp wajib diisi.',
                formData
            });
        }

        if (password !== confirmPassword) {
            return res.render('auth/register', { 
                error: 'Konfirmasi kata sandi tidak cocok.',
                formData
            });
        }

        if (password.length < 6) {
            return res.render('auth/register', { 
                error: 'Kata sandi minimal 6 karakter.',
                formData
            });
        }

        if (!privacyConsent || !dataConsent) {
            return res.render('auth/register', { 
                error: 'Anda harus menyetujui Kebijakan Privasi dan Pemrosesan Data.',
                formData
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('auth/register', { 
                error: 'Format alamat email tidak valid.',
                formData
            });
        }

        // Validate & normalize phone number
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (!normalizedPhone) {
            return res.render('auth/register', { 
                error: 'Format nomor WhatsApp tidak valid. Gunakan format internasional (contoh: 081234567890 atau 81234567890).',
                formData
            });
        }

        // Check if email already exists
        const allUsers = userModel.getAllUsers();
        if (allUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.status !== 'deleted')) {
            return res.render('auth/register', { 
                error: 'Alamat email sudah terdaftar. Silakan login atau gunakan email lain.',
                formData
            });
        }

        // Check if phone number already exists
        if (userModel.getUserByPhone(normalizedPhone)) {
            return res.render('auth/register', { 
                error: 'Nomor WhatsApp sudah digunakan oleh akun lain.',
                formData
            });
        }

        try {
            // Request OTP via WhatsApp
            const otpResult = await otpService.requestOtp({
                rawPhone: normalizedPhone,
                purpose: 'register'
            });

            if (!otpResult.success) {
                return res.render('auth/register', { 
                    error: otpResult.message || 'Gagal mengirim kode OTP ke WhatsApp Anda.',
                    formData
                });
            }

            // Store pending registration data in session
            req.session.pendingRegistration = {
                name,
                email,
                password,
                phoneNumber: normalizedPhone,
                challengeId: otpResult.challengeId,
                resendAvailableAt: Date.now() + (otpResult.resendCooldownSeconds || 60) * 1000
            };

            return res.redirect('/auth/register/verify');
        } catch (error) {
            console.error('[Register Error]', error);
            return res.render('auth/register', { 
                error: error.message || 'Terjadi kesalahan sistem.',
                formData
            });
        }
    },

    showRegisterVerify(req, res) {
        const pending = req.session.pendingRegistration;
        if (!pending) {
            return res.redirect('/auth/register');
        }

        res.render('auth/register_verify', {
            error: null,
            name: pending.name,
            maskedPhone: maskPhoneNumber(pending.phoneNumber),
            phoneNumber: pending.phoneNumber,
            challengeId: pending.challengeId,
            resendCooldown: Math.max(0, Math.ceil((pending.resendAvailableAt - Date.now()) / 1000))
        });
    },

    async verifyRegisterOtp(req, res) {
        const pending = req.session.pendingRegistration;
        if (!pending) {
            return res.redirect('/auth/register');
        }

        const otpCode = req.body.otp || req.body.otpCode;
        if (!otpCode || otpCode.trim().length !== 6) {
            return res.render('auth/register_verify', {
                error: 'Silakan masukkan 6-digit kode OTP secara lengkap.',
                name: pending.name,
                maskedPhone: maskPhoneNumber(pending.phoneNumber),
                phoneNumber: pending.phoneNumber,
                challengeId: pending.challengeId,
                resendCooldown: 0
            });
        }

        try {
            const verifyResult = await otpService.verifyOtp({
                challengeId: pending.challengeId,
                otpCode: otpCode.trim(),
                purpose: 'register',
                rawPhone: pending.phoneNumber
            });

            if (!verifyResult.success) {
                return res.render('auth/register_verify', {
                    error: verifyResult.message || 'Kode OTP tidak valid atau kedaluwarsa.',
                    name: pending.name,
                    maskedPhone: maskPhoneNumber(pending.phoneNumber),
                    phoneNumber: pending.phoneNumber,
                    challengeId: pending.challengeId,
                    resendCooldown: 0
                });
            }

            // OTP Verified! Create user with phone_verified = true
            const user = await userModel.createUser(
                pending.name,
                pending.email,
                pending.password,
                pending.phoneNumber,
                true // phone_verified
            );

            // Clean up registration session and establish login session
            delete req.session.pendingRegistration;
            req.session.user = user;

            return res.redirect('/onboarding/1');
        } catch (err) {
            console.error('[Verify Register OTP Error]', err);
            return res.render('auth/register_verify', {
                error: 'Terjadi kesalahan sistem saat memverifikasi.',
                name: pending.name,
                maskedPhone: maskPhoneNumber(pending.phoneNumber),
                phoneNumber: pending.phoneNumber,
                challengeId: pending.challengeId,
                resendCooldown: 0
            });
        }
    },

    async resendRegisterOtp(req, res) {
        const pending = req.session.pendingRegistration;
        if (!pending) {
            return res.status(400).json({ success: false, message: 'Sesi registrasi tidak ditemukan. Silakan isi form kembali.' });
        }

        try {
            const result = await otpService.requestOtp({
                rawPhone: pending.phoneNumber,
                purpose: 'register'
            });

            if (!result.success) {
                return res.status(result.error === 'COOLDOWN_ACTIVE' ? 429 : 400).json(result);
            }

            pending.challengeId = result.challengeId;
            pending.resendAvailableAt = Date.now() + (result.resendCooldownSeconds || 60) * 1000;

            return res.status(200).json({
                success: true,
                message: result.message,
                resendCooldownSeconds: result.resendCooldownSeconds
            });
        } catch (err) {
            console.error('[Resend Register OTP Error]', err);
            return res.status(500).json({ success: false, message: 'Gagal mengirim ulang OTP.' });
        }
    },

    showLogin(req, res) {
        res.render('auth/login', { error: null });
    },

    async login(req, res) {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.render('auth/login', { error: 'Email and password are required.' });
        }

        try {
            const user = await userModel.authenticateUser(email, password);
            if (!user) {
                return res.render('auth/login', { error: 'Invalid email or password.' });
            }

            req.session.user = user;

            // Trigger login activity recording & WhatsApp notification asynchronously (guaranteed non-blocking)
            loginNotificationService.notifyLoginSuccess({
                user,
                req,
                loginMethod: 'password'
            }).catch(err => {
                console.error('[Login] Error in login notification:', err.message);
            });
            
            if (user.role === 'admin') {
                return res.redirect('/admin/dashboard');
            }

            if (!user.onboarding_completed) {
                return res.redirect('/onboarding/1');
            }
            
            return res.redirect('/app/dashboard');
        } catch (error) {
            return res.render('auth/login', { error: 'An error occurred during login.' });
        }
    },

    logout(req, res) {
        req.session.destroy();
        res.redirect('/');
    }
};
