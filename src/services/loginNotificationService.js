const systemConfigModel = require('../models/systemConfigModel');
const loginActivityModel = require('../models/loginActivityModel');
const auditLogModel = require('../models/auditLogModel');
const { getProvider } = require('./whatsapp');
const { parseUserAgent, getClientIp, estimateLocation } = require('../utils/deviceDetector');
const { normalizePhoneNumber } = require('../utils/phoneNormalizer');

const DEFAULT_TEMPLATE = `Notifikasi Keamanan SkinCheck

Halo, {name}!

Kami mendeteksi aktivitas login baru pada akun SkinCheck Anda.

Detail aktivitas:
- Waktu login: {time}
- Perangkat: {device}
- Browser: {browser}
- Lokasi perkiraan: {location}

Jika ini adalah aktivitas Anda, tidak diperlukan tindakan lebih lanjut.

Jika Anda tidak merasa melakukan login tersebut, segera buka aplikasi SkinCheck dan amankan akun Anda dengan mengganti kata sandi atau menghubungi administrator.

Terima kasih telah menggunakan SkinCheck.

*Pesan otomatis dari sistem keamanan SkinCheck. Mohon tidak membalas pesan ini.*`;

function formatIndonesianTime(date = new Date()) {
    try {
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (_) {
        return date.toISOString();
    }
}

function compileMessage({ template, name, time, device, browser, location }) {
    const rawTemplate = template || DEFAULT_TEMPLATE;
    return rawTemplate
        .replace(/\{name\}/g, name || 'Pengguna')
        .replace(/\{time\}/g, time || formatIndonesianTime())
        .replace(/\{device\}/g, device || 'Desktop / PC')
        .replace(/\{browser\}/g, browser || 'Web Browser')
        .replace(/\{location\}/g, location || 'Lokal / Jaringan Internal');
}

class LoginNotificationService {
    /**
     * Handle successful login event.
     * Records login activity and sends WhatsApp notification if enabled and phone exists.
     * Guaranteed to NEVER throw errors that disrupt the user's login session.
     */
    async notifyLoginSuccess({ user, req, loginMethod = 'password' }) {
        if (!user || !user.id) {
            console.warn('[LoginNotification] Invalid user object passed to notifyLoginSuccess');
            return null;
        }

        const fullConfig = systemConfigModel.getConfig();
        const waConfig = fullConfig.whatsapp || {};
        const loginNotifConfig = waConfig.login_notification || { enabled: true, max_retries: 2 };
        const isEnabled = Boolean(loginNotifConfig.enabled);

        // 1. Extract device, browser, IP, location from HTTP request
        const userAgentHeader = req?.headers?.['user-agent'] || '';
        const { device, browser } = parseUserAgent(userAgentHeader);
        const ipAddress = getClientIp(req);
        const location = estimateLocation(ipAddress, req);
        const now = new Date();
        const formattedTime = formatIndonesianTime(now);

        // 2. Check user's registered WhatsApp phone number
        let rawPhone = user.phone_number;
        let normalizedPhone = null;
        if (rawPhone && typeof rawPhone === 'string' && rawPhone.trim() !== '') {
            try {
                normalizedPhone = normalizePhoneNumber(rawPhone.trim());
            } catch (err) {
                console.warn('[LoginNotification] Failed to normalize user phone:', err.message);
            }
        }

        // Determine initial WA notification status
        let initialWaStatus = 'pending';
        let skipReason = null;

        if (!isEnabled) {
            initialWaStatus = 'disabled';
            skipReason = 'Fitur notifikasi login WhatsApp dinonaktifkan oleh administrator.';
        } else if (!normalizedPhone) {
            initialWaStatus = 'no_phone';
            skipReason = 'Pengguna belum menautkan nomor WhatsApp pada akun.';
        }

        // 3. Record login activity in database
        const activity = loginActivityModel.createActivity({
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            phoneNumber: normalizedPhone,
            ipAddress,
            device,
            browser,
            location,
            loginMethod,
            waStatus: initialWaStatus,
            waDetails: {
                enabled: isEnabled,
                provider: waConfig.active_provider || 'fonnte',
                error: skipReason
            }
        });

        // If disabled or user has no phone, do not dispatch WhatsApp message
        if (!isEnabled || !normalizedPhone) {
            return {
                activityId: activity.id,
                sent: false,
                status: initialWaStatus,
                message: skipReason
            };
        }

        // 4. Compile WhatsApp message format
        const messageText = compileMessage({
            template: loginNotifConfig.template,
            name: user.name,
            time: formattedTime,
            device,
            browser,
            location
        });

        // 5. Dispatch WhatsApp notification using active provider
        try {
            const provider = getProvider();
            const dispatchResult = await provider.sendLoginNotification({
                to: normalizedPhone,
                messageText
            });

            if (dispatchResult && dispatchResult.success) {
                loginActivityModel.updateWaNotification(activity.id, {
                    status: 'sent',
                    provider: dispatchResult.provider || waConfig.active_provider,
                    messageId: dispatchResult.messageId || null,
                    error: null
                });

                auditLogModel.addLog({
                    category: 'SECURITY_LOGIN_NOTIF',
                    action: `Notifikasi login WhatsApp berhasil dikirim ke ${normalizedPhone} (${user.name})`,
                    status: 'SUCCESS',
                    details: {
                        userId: user.id,
                        activityId: activity.id,
                        provider: dispatchResult.provider,
                        messageId: dispatchResult.messageId
                    },
                    user: { id: user.id, email: user.email, name: user.name }
                });

                return {
                    activityId: activity.id,
                    sent: true,
                    status: 'sent',
                    messageId: dispatchResult.messageId
                };
            } else {
                const errorMsg = dispatchResult?.message || dispatchResult?.error || 'Gagal mengirim pesan WhatsApp.';
                loginActivityModel.updateWaNotification(activity.id, {
                    status: 'failed',
                    provider: dispatchResult?.provider || waConfig.active_provider,
                    messageId: null,
                    error: errorMsg
                });

                auditLogModel.addLog({
                    category: 'SECURITY_LOGIN_NOTIF',
                    action: `Pengiriman notifikasi login WhatsApp gagal: ${errorMsg}`,
                    status: 'FAILED',
                    details: {
                        userId: user.id,
                        activityId: activity.id,
                        error: errorMsg
                    },
                    user: { id: user.id, email: user.email, name: user.name }
                });

                return {
                    activityId: activity.id,
                    sent: false,
                    status: 'failed',
                    error: errorMsg
                };
            }
        } catch (dispatchError) {
            console.error('[LoginNotification] Exception during WhatsApp dispatch:', dispatchError.message);
            loginActivityModel.updateWaNotification(activity.id, {
                status: 'failed',
                provider: waConfig.active_provider,
                messageId: null,
                error: dispatchError.message
            });

            return {
                activityId: activity.id,
                sent: false,
                status: 'failed',
                error: dispatchError.message
            };
        }
    }

    /**
     * Retry sending a failed WhatsApp login notification
     * Includes duplicate prevention and retry limit checking
     */
    async retryNotification(activityId, adminUser = null) {
        const activity = loginActivityModel.getById(activityId);
        if (!activity) {
            return { success: false, message: 'Riwayat aktivitas login tidak ditemukan.' };
        }

        // Prevent duplicate sending if already sent
        if (activity.wa_notification?.status === 'sent') {
            return {
                success: false,
                message: 'Notifikasi login untuk aktivitas ini sudah berhasil terkirim sebelumnya (mencegah duplikasi pesan).'
            };
        }

        if (!activity.phone_number) {
            return {
                success: false,
                message: 'Tidak dapat mengirim ulang: Pengguna tidak memiliki nomor WhatsApp yang terdaftar.'
            };
        }

        const fullConfig = systemConfigModel.getConfig();
        const maxRetries = fullConfig.whatsapp?.login_notification?.max_retries || 2;
        const currentRetries = activity.wa_notification?.retries || 0;

        if (currentRetries >= maxRetries) {
            return {
                success: false,
                message: `Batas percobaan kirim ulang telah tercapai (maksimal ${maxRetries} kali).`
            };
        }

        const messageText = compileMessage({
            template: fullConfig.whatsapp?.login_notification?.template,
            name: activity.user_name,
            time: activity.formatted_time,
            device: activity.device,
            browser: activity.browser,
            location: activity.location
        });

        try {
            const provider = getProvider();
            const result = await provider.sendLoginNotification({
                to: activity.phone_number,
                messageText
            });

            if (result && result.success) {
                loginActivityModel.updateWaNotification(activity.id, {
                    status: 'sent',
                    provider: result.provider,
                    messageId: result.messageId,
                    error: null,
                    incrementRetry: true
                });

                auditLogModel.addLog({
                    category: 'SECURITY_LOGIN_NOTIF_RETRY',
                    action: `Kirim ulang notifikasi login berhasil untuk user ID ${activity.user_id}`,
                    status: 'SUCCESS',
                    details: { activityId: activity.id, messageId: result.messageId },
                    user: adminUser
                });

                return {
                    success: true,
                    message: 'Notifikasi WhatsApp berhasil dikirim ulang!',
                    messageId: result.messageId
                };
            } else {
                const errorMsg = result?.message || result?.error || 'Gagal mengirim ulang.';
                loginActivityModel.updateWaNotification(activity.id, {
                    status: 'failed',
                    provider: result?.provider,
                    error: errorMsg,
                    incrementRetry: true
                });

                return {
                    success: false,
                    message: `Gagal mengirim ulang: ${errorMsg}`
                };
            }
        } catch (err) {
            loginActivityModel.updateWaNotification(activity.id, {
                status: 'failed',
                error: err.message,
                incrementRetry: true
            });
            return {
                success: false,
                message: `Kesalahan jaringan saat kirim ulang: ${err.message}`
            };
        }
    }
}

module.exports = new LoginNotificationService();
