const BaseWhatsAppProvider = require('./baseProvider');

class FonnteWhatsAppProvider extends BaseWhatsAppProvider {
    constructor(config = {}) {
        super('fonnte');
        this.token = (config.token !== undefined) ? config.token : (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN || '');
        this.apiUrl = (config.apiUrl !== undefined) ? config.apiUrl : (process.env.WHATSAPP_API_BASE_URL || 'https://api.fonnte.com/send');
    }

    checkConfiguration() {
        const missing = [];
        if (!this.token || this.token.trim() === '') {
            missing.push('WHATSAPP_ACCESS_TOKEN (Fonnte API Token)');
        }
        return {
            configured: missing.length === 0,
            provider: 'fonnte',
            missingFields: missing
        };
    }

    async sendOtpMessage({ to, otpCode }) {
        const check = this.checkConfiguration();
        if (!check.configured) {
            console.error(`[WhatsApp Fonnte] Missing token: ${check.missingFields.join(', ')}`);
            return {
                success: false,
                provider: 'fonnte',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'MISSING_CREDENTIALS',
                message: 'Token API WhatsApp belum dikonfigurasi di file .env.'
            };
        }

        // Fonnte accepts numbers in formats: 08xxx or 628xxx
        const target = to.replace(/^\+/, '');

        const messageText = `SkinCheck Verification\n\nKode verifikasi Anda adalah: *${otpCode}*\n\nKode ini berlaku selama 5 menit.\nJangan bagikan kode ini kepada siapapun demi keamanan akun Anda.`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const params = new URLSearchParams();
            params.append('target', target);
            params.append('message', messageText);
            params.append('countryCode', '62');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.token
                },
                body: params,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok || data.status === false) {
                let errorMsg = data.reason || data.message || `HTTP ${response.status}`;
                if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('disconnected')) {
                    errorMsg = 'Perangkat WhatsApp di Fonnte berstatus Disconnected (belum terhubung). Silakan klik tombol "Connect" dan scan QR Code di dashboard Fonnte Anda.';
                }
                console.error('[WhatsApp Fonnte] API Error:', errorMsg);
                return {
                    success: false,
                    provider: 'fonnte',
                    messageId: null,
                    deliveryStatus: 'failed',
                    error: 'DEVICE_DISCONNECTED',
                    message: errorMsg
                };
            }

            const messageId = Array.isArray(data.id) ? data.id[0] : (data.id || 'fonnte_' + Date.now());
            console.log(`[WhatsApp Fonnte] Successfully dispatched to ${to} (Message ID: ${messageId})`);

            return {
                success: true,
                provider: 'fonnte',
                messageId: messageId,
                deliveryStatus: 'sent'
            };
        } catch (err) {
            console.error('[WhatsApp Fonnte] Network Error:', err.message);
            return {
                success: false,
                provider: 'fonnte',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'NETWORK_ERROR',
                message: err.name === 'AbortError' ? 'Koneksi ke server WhatsApp timed out.' : err.message
            };
        }
    }

    async sendLoginNotification({ to, messageText }) {
        const check = this.checkConfiguration();
        if (!check.configured) {
            console.error(`[WhatsApp Fonnte] Missing token: ${check.missingFields.join(', ')}`);
            return {
                success: false,
                provider: 'fonnte',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'MISSING_CREDENTIALS',
                message: 'Token API WhatsApp belum dikonfigurasi di file .env.'
            };
        }

        const target = to.replace(/^\+/, '');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const params = new URLSearchParams();
            params.append('target', target);
            params.append('message', messageText);
            params.append('countryCode', '62');

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.token
                },
                body: params,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await response.json();

            if (!response.ok || data.status === false) {
                let errorMsg = data.reason || data.message || `HTTP ${response.status}`;
                if (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('disconnected')) {
                    errorMsg = 'Perangkat WhatsApp di Fonnte berstatus Disconnected (belum terhubung).';
                }
                console.error('[WhatsApp Fonnte] Login Notification API Error:', errorMsg);
                return {
                    success: false,
                    provider: 'fonnte',
                    messageId: null,
                    deliveryStatus: 'failed',
                    error: 'DEVICE_DISCONNECTED',
                    message: errorMsg
                };
            }

            const messageId = Array.isArray(data.id) ? data.id[0] : (data.id || 'fonnte_' + Date.now());
            console.log(`[WhatsApp Fonnte] Login notification dispatched to ${to} (Message ID: ${messageId})`);

            return {
                success: true,
                provider: 'fonnte',
                messageId: messageId,
                deliveryStatus: 'sent'
            };
        } catch (err) {
            console.error('[WhatsApp Fonnte] Login Notification Network Error:', err.message);
            return {
                success: false,
                provider: 'fonnte',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'NETWORK_ERROR',
                message: err.name === 'AbortError' ? 'Koneksi ke server WhatsApp timed out.' : err.message
            };
        }
    }
}

module.exports = FonnteWhatsAppProvider;
