const BaseWhatsAppProvider = require('./baseProvider');

class MetaCloudApiProvider extends BaseWhatsAppProvider {
    constructor(config = {}) {
        super('meta');
        this.accessToken = (config.accessToken !== undefined) ? config.accessToken : (process.env.WHATSAPP_ACCESS_TOKEN || '');
        this.phoneNumberId = (config.phoneNumberId !== undefined) ? config.phoneNumberId : (process.env.WHATSAPP_PHONE_NUMBER_ID || '');
        this.businessAccountId = (config.businessAccountId !== undefined) ? config.businessAccountId : (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '');
        this.baseUrl = config.baseUrl || process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v21.0';
        this.templateName = config.templateName || process.env.WHATSAPP_TEMPLATE_NAME || 'skincheck_verification';
        this.templateLang = config.templateLang || process.env.WHATSAPP_TEMPLATE_LANG || 'id';
    }

    checkConfiguration() {
        const missing = [];
        if (!this.accessToken || this.accessToken.trim() === '' || this.accessToken.includes('your_token_here')) {
            missing.push('WHATSAPP_ACCESS_TOKEN');
        }
        if (!this.phoneNumberId || this.phoneNumberId.trim() === '' || this.phoneNumberId.includes('your_phone_id_here')) {
            missing.push('WHATSAPP_PHONE_NUMBER_ID');
        }

        return {
            configured: missing.length === 0,
            provider: 'meta',
            missingFields: missing
        };
    }

    async sendOtpMessage({ to, otpCode, templateName = null, templateLang = null }) {
        const check = this.checkConfiguration();
        if (!check.configured) {
            console.error(`[WhatsApp Meta] Provider configuration incomplete: missing ${check.missingFields.join(', ')}`);
            return {
                success: false,
                provider: 'meta',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'MISSING_CREDENTIALS',
                message: `WhatsApp provider credentials missing: ${check.missingFields.join(', ')}. Please configure them in .env.`
            };
        }

        // WhatsApp recipient: numbers only, no leading '+'
        const recipientNumber = to.replace(/^\+/, '');
        const activeTemplate = templateName || this.templateName;
        const activeLang = templateLang || this.templateLang;

        const url = `${this.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(this.phoneNumberId)}/messages`;

        // Payload for approved Meta authentication template
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'template',
            template: {
                name: activeTemplate,
                language: {
                    code: activeLang
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: otpCode
                            }
                        ]
                    },
                    {
                        type: 'button',
                        sub_type: 'url',
                        index: '0',
                        parameters: [
                            {
                                type: 'text',
                                text: otpCode
                            }
                        ]
                    }
                ]
            }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();

            if (!response.ok) {
                // If the button parameter caused template structure mismatch, retry with simple body template
                if (result.error && result.error.code === 132000) {
                    console.warn('[WhatsApp Meta] Template parameter mismatch, retrying with body-only template...');
                    return await this._sendWithBodyOnlyTemplate(url, recipientNumber, activeTemplate, activeLang, otpCode);
                }

                // Sanitize error before reporting
                const errorMsg = result.error ? result.error.message : `HTTP ${response.status}`;
                console.error(`[WhatsApp Meta] API Error [${response.status}]:`, errorMsg);
                return {
                    success: false,
                    provider: 'meta',
                    messageId: null,
                    deliveryStatus: 'failed',
                    error: 'META_API_ERROR',
                    message: `Meta API rejected message: ${errorMsg}`
                };
            }

            const messageId = result.messages && result.messages[0] ? result.messages[0].id : null;
            return {
                success: true,
                provider: 'meta',
                messageId: messageId,
                deliveryStatus: 'sent'
            };
        } catch (err) {
            clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError';
            const sanitizedMessage = isTimeout ? 'Request timed out after 10s' : (err.message || 'Network error');
            console.error('[WhatsApp Meta] Dispatch error:', sanitizedMessage);

            return {
                success: false,
                provider: 'meta',
                messageId: null,
                deliveryStatus: 'failed',
                error: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
                message: sanitizedMessage
            };
        }
    }

    async _sendWithBodyOnlyTemplate(url, recipientNumber, templateName, templateLang, otpCode) {
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'template',
            template: {
                name: templateName,
                language: {
                    code: templateLang
                },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            {
                                type: 'text',
                                text: otpCode
                            }
                        ]
                    }
                ]
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!response.ok) {
                const errorMsg = result.error ? result.error.message : `HTTP ${response.status}`;
                return {
                    success: false,
                    provider: 'meta',
                    messageId: null,
                    deliveryStatus: 'failed',
                    error: 'META_API_ERROR',
                    message: errorMsg
                };
            }

            const messageId = result.messages && result.messages[0] ? result.messages[0].id : null;
            return {
                success: true,
                provider: 'meta',
                messageId: messageId,
                deliveryStatus: 'sent'
            };
        } catch (err) {
            return {
                success: false,
                provider: 'meta',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'NETWORK_ERROR',
                message: err.message
            };
        }
    }

    async sendLoginNotification({ to, messageText }) {
        const check = this.checkConfiguration();
        if (!check.configured) {
            console.error(`[WhatsApp Meta] Provider configuration incomplete: missing ${check.missingFields.join(', ')}`);
            return {
                success: false,
                provider: 'meta',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'MISSING_CREDENTIALS',
                message: `WhatsApp provider credentials missing: ${check.missingFields.join(', ')}`
            };
        }

        const recipientNumber = to.replace(/^\+/, '');
        const url = `${this.baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(this.phoneNumberId)}/messages`;

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'text',
            text: {
                preview_url: false,
                body: messageText
            }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const result = await response.json();

            if (!response.ok) {
                const errorMsg = result.error ? result.error.message : `HTTP ${response.status}`;
                console.error(`[WhatsApp Meta] Login Notification Error [${response.status}]:`, errorMsg);
                return {
                    success: false,
                    provider: 'meta',
                    messageId: null,
                    deliveryStatus: 'failed',
                    error: 'META_API_ERROR',
                    message: errorMsg
                };
            }

            const messageId = result.messages && result.messages[0] ? result.messages[0].id : null;
            return {
                success: true,
                provider: 'meta',
                messageId: messageId,
                deliveryStatus: 'sent'
            };
        } catch (err) {
            clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError';
            const sanitizedMessage = isTimeout ? 'Request timed out after 10s' : (err.message || 'Network error');
            console.error('[WhatsApp Meta] Login Notification Dispatch error:', sanitizedMessage);

            return {
                success: false,
                provider: 'meta',
                messageId: null,
                deliveryStatus: 'failed',
                error: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
                message: sanitizedMessage
            };
        }
    }
}

module.exports = MetaCloudApiProvider;
