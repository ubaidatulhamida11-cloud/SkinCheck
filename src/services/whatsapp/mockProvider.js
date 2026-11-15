const BaseWhatsAppProvider = require('./baseProvider');
const crypto = require('crypto');

class MockWhatsAppProvider extends BaseWhatsAppProvider {
    constructor() {
        super('mock');
        this.sentMessages = [];
        this.simulateError = false;
    }

    checkConfiguration() {
        return {
            configured: true,
            provider: 'mock',
            missingFields: []
        };
    }

    setSimulateError(shouldError) {
        this.simulateError = Boolean(shouldError);
    }

    getSentMessages() {
        return this.sentMessages;
    }

    getLastOtpForPhone(phoneNumber) {
        const matches = this.sentMessages.filter(m => m.to === phoneNumber);
        if (matches.length === 0) return null;
        return matches[matches.length - 1].otpCode || null;
    }

    clearHistory() {
        this.sentMessages = [];
    }

    async sendOtpMessage({ to, otpCode, templateName = 'skincheck_verification', templateLang = 'id' }) {
        if (this.simulateError) {
            return {
                success: false,
                provider: 'mock',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'SIMULATED_PROVIDER_ERROR',
                message: 'Simulated network or provider failure for testing.'
            };
        }

        // Generate synthetic WhatsApp Message ID
        const mockMsgId = 'wamid.HBgL' + crypto.randomBytes(12).toString('hex').toUpperCase();

        const record = {
            id: mockMsgId,
            to,
            otpCode,
            templateName,
            templateLang,
            timestamp: new Date().toISOString()
        };

        this.sentMessages.push(record);
        console.log(`[WhatsApp Mock Provider] Simulated delivery to ${to} (MessageId: ${mockMsgId})`);

        return {
            success: true,
            provider: 'mock',
            messageId: mockMsgId,
            deliveryStatus: 'mocked'
        };
    }

    getLastNotificationForPhone(phoneNumber) {
        const matches = this.sentMessages.filter(m => m.to === phoneNumber && m.type === 'login_notification');
        if (matches.length === 0) return null;
        return matches[matches.length - 1];
    }

    async sendLoginNotification({ to, messageText, templateName = null, templateLang = null }) {
        if (this.simulateError) {
            return {
                success: false,
                provider: 'mock',
                messageId: null,
                deliveryStatus: 'failed',
                error: 'SIMULATED_PROVIDER_ERROR',
                message: 'Simulated network or provider failure for testing.'
            };
        }

        const mockMsgId = 'wamid.HBgL' + crypto.randomBytes(12).toString('hex').toUpperCase();

        const record = {
            id: mockMsgId,
            type: 'login_notification',
            to,
            text: messageText,
            templateName,
            templateLang,
            timestamp: new Date().toISOString()
        };

        this.sentMessages.push(record);
        console.log(`[WhatsApp Mock Provider] Simulated login notification delivery to ${to} (MessageId: ${mockMsgId})`);

        return {
            success: true,
            provider: 'mock',
            messageId: mockMsgId,
            deliveryStatus: 'mocked'
        };
    }
}

module.exports = MockWhatsAppProvider;
