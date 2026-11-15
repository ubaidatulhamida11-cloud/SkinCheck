const assert = require('assert');
const systemConfigModel = require('../../src/models/systemConfigModel');
const auditLogModel = require('../../src/models/auditLogModel');
const systemIntegrationService = require('../../src/services/systemIntegrationService');
const { requireSuperAdmin } = require('../../src/middleware/authMiddleware');

async function runTests() {
    console.log('--- Testing System Configuration & Super Admin Features ---');

    // 1. Test Authorization Middleware
    console.log('Checking Super Admin role validation...');
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    // Case A: No session
    let redirectUrl = null;
    let statusCode = null;
    let jsonResponse = null;
    const reqNoSession = { session: {}, xhr: true, headers: {} };
    const resNoSession = {
        redirect: (url) => { redirectUrl = url; },
        status: (code) => {
            statusCode = code;
            return {
                json: (d) => { jsonResponse = d; },
                send: () => {}
            };
        }
    };
    requireSuperAdmin(reqNoSession, resNoSession, mockNext);
    assert.strictEqual(statusCode, 401, 'Unauthenticated user should be rejected with 401');

    // Case B: Customer role trying to access
    nextCalled = false;
    statusCode = null;
    jsonResponse = null;
    const reqCustomer = {
        session: { user: { id: 'cust_1', name: 'Regular User', role: 'customer' } },
        xhr: true,
        headers: {}
    };
    requireSuperAdmin(reqCustomer, resNoSession, mockNext);
    assert.strictEqual(statusCode, 403, 'Customer should be blocked with 403');
    assert.strictEqual(nextCalled, false, 'Next should not be called for non-admin');

    // Case C: Admin role permitted
    nextCalled = false;
    const reqAdmin = {
        session: { user: { id: 'admin_1', name: 'Super Admin', role: 'admin' } },
        xhr: true,
        headers: {}
    };
    requireSuperAdmin(reqAdmin, resNoSession, mockNext);
    assert.strictEqual(nextCalled, true, 'Super Admin should be allowed through');

    // 2. Test Credential Masking in Sanitized Config
    console.log('Checking secret masking in system config...');
    const sanitized = systemConfigModel.getSanitizedConfig();
    assert.strictEqual(sanitized.ai.providers.gemini.api_key, undefined, 'Raw API key must not be exposed');
    if (sanitized.ai.providers.gemini.api_key_masked) {
        assert(sanitized.ai.providers.gemini.api_key_masked.includes('••••'), 'API key must be masked');
    }
    assert.strictEqual(sanitized.whatsapp.providers.fonnte.token, undefined, 'Raw Fonnte token must not be exposed');
    if (sanitized.whatsapp.providers.fonnte.token_masked) {
        assert(sanitized.whatsapp.providers.fonnte.token_masked.includes('••••'), 'Fonnte token must be masked');
    }

    // 3. Test Safe Credential Preservation on Update
    console.log('Checking safe credential preservation when blank or masked on update...');
    const originalFullConfig = systemConfigModel.getConfig();
    const originalFonnteToken = originalFullConfig.whatsapp.providers.fonnte.token;

    // Admin submits form with empty or masked token
    systemConfigModel.updateWhatsAppConfig({
        fonnte: { token: 'jaKJ••••••••LJhp' }
    }, { name: 'Admin Test', email: 'admin@test.local' });

    const configAfterMaskedUpdate = systemConfigModel.getConfig();
    assert.strictEqual(
        configAfterMaskedUpdate.whatsapp.providers.fonnte.token,
        originalFonnteToken,
        'Original secret token must not be overwritten when masked string is submitted'
    );

    // 4. Test AI Integration Testing Tool
    console.log('Checking AI diagnostic integration testing...');
    const localAiTest = await systemIntegrationService.testAiProvider('local_knowledge', null, { name: 'Admin Test' });
    assert.strictEqual(localAiTest.success, true, 'Local knowledge engine test should succeed');
    assert(localAiTest.latencyMs >= 0, 'Latency should be recorded');

    const invalidAiTest = await systemIntegrationService.testAiProvider('unsupported_provider_xyz');
    assert.strictEqual(invalidAiTest.success, false, 'Unsupported provider should fail gracefully');

    // 5. Test WhatsApp Integration Testing Tool
    console.log('Checking WhatsApp diagnostic integration testing...');
    const mockWaTest = await systemIntegrationService.testWhatsAppProvider('mock', null, { name: 'Admin Test' });
    assert.strictEqual(mockWaTest.success, true, 'Mock provider test should succeed');

    // 6. Test Audit Log Recording
    console.log('Checking audit log creation and query...');
    const initialLogs = auditLogModel.getLogs(50);
    assert(Array.isArray(initialLogs), 'Audit logs should be an array');
    
    auditLogModel.addLog({
        category: 'UNIT_TEST',
        action: 'Automated test audit log entry',
        status: 'SUCCESS',
        details: { test: true },
        user: { name: 'Test Runner', email: 'runner@test.local' }
    });

    const updatedLogs = auditLogModel.getLogs(50);
    const foundLog = updatedLogs.find(l => l.category === 'UNIT_TEST');
    assert(foundLog, 'Newly added audit log must exist');
    assert.strictEqual(foundLog.user_name, 'Test Runner');

    console.log('✔ System Configuration & Super Admin tests passed successfully.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
