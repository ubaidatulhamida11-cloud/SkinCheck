const assert = require('assert');
const { MetaCloudApiProvider, MockWhatsAppProvider } = require('../../src/services/whatsapp');

async function runTests() {
    console.log('--- Testing WhatsApp Providers (Meta Cloud & Mock) ---');

    // 1. Meta Provider with Missing Credentials
    const unconfiguredMeta = new MetaCloudApiProvider({
        accessToken: '',
        phoneNumberId: ''
    });

    const check = unconfiguredMeta.checkConfiguration();
    assert.strictEqual(check.configured, false, 'Should detect unconfigured provider');
    assert(check.missingFields.includes('WHATSAPP_ACCESS_TOKEN'));
    assert(check.missingFields.includes('WHATSAPP_PHONE_NUMBER_ID'));

    // Should gracefully reject sending without crashing or falsely claiming success
    const sendResult = await unconfiguredMeta.sendOtpMessage({
        to: '+6281234567890',
        otpCode: '123456'
    });
    assert.strictEqual(sendResult.success, false, 'Cannot succeed with missing credentials');
    assert.strictEqual(sendResult.error, 'MISSING_CREDENTIALS');
    assert.strictEqual(sendResult.deliveryStatus, 'failed');

    // 2. Mock Provider normal operation
    const mock = new MockWhatsAppProvider();
    assert.strictEqual(mock.checkConfiguration().configured, true);

    const mockSend = await mock.sendOtpMessage({
        to: '+6281234567890',
        otpCode: '654321'
    });
    assert.strictEqual(mockSend.success, true);
    assert.strictEqual(mockSend.deliveryStatus, 'mocked');
    assert(mockSend.messageId.startsWith('wamid.'));
    assert.strictEqual(mock.getSentMessages().length, 1);

    // 3. Mock Provider Error Simulation (Network / API Failure)
    mock.setSimulateError(true);
    const mockErrorSend = await mock.sendOtpMessage({
        to: '+6281234567890',
        otpCode: '654321'
    });
    assert.strictEqual(mockErrorSend.success, false);
    assert.strictEqual(mockErrorSend.error, 'SIMULATED_PROVIDER_ERROR');
    assert.strictEqual(mockErrorSend.deliveryStatus, 'failed');

    // 4. Fonnte Provider configuration check
    const { FonnteWhatsAppProvider } = require('../../src/services/whatsapp');
    const unconfiguredFonnte = new FonnteWhatsAppProvider({ token: '' });
    assert.strictEqual(unconfiguredFonnte.checkConfiguration().configured, false);
    const fonnteRes = await unconfiguredFonnte.sendOtpMessage({ to: '+6281234567890', otpCode: '111222' });
    assert.strictEqual(fonnteRes.success, false);
    assert.strictEqual(fonnteRes.error, 'MISSING_CREDENTIALS');

    console.log('✔ WhatsApp Providers unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
