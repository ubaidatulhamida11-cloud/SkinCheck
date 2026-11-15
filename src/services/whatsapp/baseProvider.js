/**
 * Base WhatsApp Messaging Provider Interface
 */
class BaseWhatsAppProvider {
    constructor(name) {
        this.name = name;
    }

    /**
     * Sends an OTP authentication message to a normalized E.164 phone number.
     * @param {Object} options
     * @param {string} options.to E.164 formatted recipient phone number
     * @param {string} options.otpCode 6-digit numeric OTP
     * @param {string} [options.templateName] Approved WhatsApp template name
     * @param {string} [options.templateLang] Language code (e.g. 'id', 'en')
     * @returns {Promise<{success: boolean, provider: string, messageId?: string, deliveryStatus: string, error?: string, rawResponse?: any}>}
     */
    async sendOtpMessage({ to, otpCode, templateName, templateLang }) {
        throw new Error('sendOtpMessage must be implemented by provider');
    }

    /**
     * Inspects provider configuration and credentials.
     * @returns {{ configured: boolean, provider: string, missingFields: string[] }}
     */
    checkConfiguration() {
        return { configured: false, provider: this.name, missingFields: [] };
    }

    /**
     * Sends a login activity security notification message to a recipient phone number.
     * @param {Object} options
     * @param {string} options.to E.164 formatted recipient phone number
     * @param {string} options.messageText Formatted login security message
     * @param {string} [options.templateName] Optional template name for providers that require pre-approved templates
     * @param {string} [options.templateLang] Optional language code
     * @returns {Promise<{success: boolean, provider: string, messageId?: string, deliveryStatus: string, error?: string, rawResponse?: any}>}
     */
    async sendLoginNotification({ to, messageText, templateName, templateLang }) {
        throw new Error('sendLoginNotification must be implemented by provider');
    }
}

module.exports = BaseWhatsAppProvider;
