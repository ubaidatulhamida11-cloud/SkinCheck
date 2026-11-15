const assert = require('assert');
const { parseUserAgent, getClientIp, estimateLocation } = require('../../src/utils/deviceDetector');
const loginActivityModel = require('../../src/models/loginActivityModel');
const loginNotificationService = require('../../src/services/loginNotificationService');
const systemConfigModel = require('../../src/models/systemConfigModel');
const userModel = require('../../src/models/userModel');
const authController = require('../../src/controllers/authController');
const whatsappOtpController = require('../../src/controllers/whatsappOtpController');
const { setProvider, MockWhatsAppProvider, resetProvider } = require('../../src/services/whatsapp');

async function runTests() {
    console.log('--- Testing WhatsApp Login Notification Feature ---');

    // Setup mock provider for isolated testing
    const mockProvider = new MockWhatsAppProvider();
    setProvider(mockProvider);

    // ---------------------------------------------------------
    // 1. Device, Browser & IP Detector Tests
    // ---------------------------------------------------------
    console.log('Testing device and user agent parsing...');
    const chromeWindowsUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const chromeParsed = parseUserAgent(chromeWindowsUA);
    assert(chromeParsed.browser.includes('Google Chrome'), 'Browser should identify as Google Chrome');
    assert(chromeParsed.device.includes('Windows'), 'Device should identify as Windows');

    const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1';
    const iphoneParsed = parseUserAgent(iphoneUA);
    assert(iphoneParsed.browser.includes('Safari'), 'Browser should identify as Safari');
    assert(iphoneParsed.device.includes('iPhone'), 'Device should identify as Apple iPhone');

    const mockReqLocal = { headers: { 'x-forwarded-for': '127.0.0.1' }, socket: {} };
    const ip = getClientIp(mockReqLocal);
    assert.strictEqual(ip, '127.0.0.1', 'IP should resolve to 127.0.0.1');
    const loc = estimateLocation(ip, mockReqLocal);
    assert(loc.includes('Lokal') || loc.includes('Internal'), 'Location should indicate local network');

    // ---------------------------------------------------------
    // 2. User Isolation & Login Activity Model Tests
    // ---------------------------------------------------------
    console.log('Testing login activity storage and user authorization isolation...');
    const userAId = 'test_user_a_' + Date.now();
    const userBId = 'test_user_b_' + Date.now();

    const actA = loginActivityModel.createActivity({
        userId: userAId,
        userName: 'User A',
        userEmail: 'userA@test.local',
        phoneNumber: '+628123456701',
        ipAddress: '127.0.0.1',
        device: 'Windows 11 (PC)',
        browser: 'Google Chrome',
        location: 'Lokal / Jaringan Internal',
        waStatus: 'sent'
    });

    const actB = loginActivityModel.createActivity({
        userId: userBId,
        userName: 'User B',
        userEmail: 'userB@test.local',
        phoneNumber: '+628123456702',
        ipAddress: '127.0.0.1',
        device: 'Apple iPhone',
        browser: 'Safari',
        location: 'Lokal / Jaringan Internal',
        waStatus: 'sent'
    });

    const userAHistory = loginActivityModel.getByUserId(userAId);
    const userBHistory = loginActivityModel.getByUserId(userBId);

    assert(userAHistory.every(h => h.user_id === userAId), 'User A history must strictly only contain User A records');
    assert(userBHistory.every(h => h.user_id === userBId), 'User B history must strictly only contain User B records');
    assert(!userAHistory.some(h => h.id === actB.id), 'User A must not be able to view User B login activity');
    assert(!userBHistory.some(h => h.id === actA.id), 'User B must not be able to view User A login activity');

    // ---------------------------------------------------------
    // 3. Successful Login Triggers 1 WhatsApp Notification
    // ---------------------------------------------------------
    console.log('Testing successful login triggers 1 WhatsApp notification...');
    mockProvider.clearHistory();
    const testPhone = '+628123456789';
    const testUserWithPhone = {
        id: 'test_notif_user_1',
        name: 'Siti Rahma',
        email: 'siti@example.local',
        phone_number: testPhone,
        phone_verified: true,
        role: 'customer'
    };

    const mockHttpReq = {
        headers: {
            'user-agent': chromeWindowsUA,
            'x-forwarded-for': '127.0.0.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
    };

    const notifResult = await loginNotificationService.notifyLoginSuccess({
        user: testUserWithPhone,
        req: mockHttpReq,
        loginMethod: 'password'
    });

    assert(notifResult.sent === true, 'Notification should be marked as sent');
    assert.strictEqual(notifResult.status, 'sent', 'Status should be sent');

    const sentNotifs = mockProvider.getSentMessages().filter(m => m.type === 'login_notification');
    assert.strictEqual(sentNotifs.length, 1, 'Exactly 1 login notification message should be dispatched');
    assert.strictEqual(sentNotifs[0].to, testPhone, 'Notification must be sent to the user registered phone number');
    assert(sentNotifs[0].text.includes('Siti Rahma'), 'Message text must include user name');
    assert(sentNotifs[0].text.includes('Waktu login'), 'Message text must include login time');
    assert(sentNotifs[0].text.includes('Perangkat'), 'Message text must include device info');

    // ---------------------------------------------------------
    // 4. User without phone number records activity safely
    // ---------------------------------------------------------
    console.log('Testing login for user without phone number...');
    mockProvider.clearHistory();
    const testUserNoPhone = {
        id: 'test_notif_user_2',
        name: 'Budi Santoso',
        email: 'budi@example.local',
        phone_number: null,
        phone_verified: false,
        role: 'customer'
    };

    const noPhoneResult = await loginNotificationService.notifyLoginSuccess({
        user: testUserNoPhone,
        req: mockHttpReq,
        loginMethod: 'password'
    });

    assert.strictEqual(noPhoneResult.sent, false, 'No message should be sent for user without phone number');
    assert.strictEqual(noPhoneResult.status, 'no_phone', 'Status should be no_phone');
    assert.strictEqual(mockProvider.getSentMessages().filter(m => m.type === 'login_notification').length, 0, 'No WhatsApp message should be dispatched');

    // ---------------------------------------------------------
    // 5. WhatsApp Provider Failure Does Not Disrupt Login
    // ---------------------------------------------------------
    console.log('Testing WhatsApp delivery failure handling...');
    mockProvider.clearHistory();
    mockProvider.setSimulateError(true);

    const failResult = await loginNotificationService.notifyLoginSuccess({
        user: testUserWithPhone,
        req: mockHttpReq,
        loginMethod: 'password'
    });

    assert.strictEqual(failResult.sent, false, 'Delivery should be marked as failed');
    assert.strictEqual(failResult.status, 'failed', 'Status should be failed');
    
    // Check record in database
    const failedActivity = loginActivityModel.getById(failResult.activityId);
    assert(failedActivity !== null, 'Activity must be recorded even when delivery fails');
    assert.strictEqual(failedActivity.wa_notification.status, 'failed', 'Activity status must be failed');

    // Reset simulate error
    mockProvider.setSimulateError(false);

    // ---------------------------------------------------------
    // 6. Safe & Limited Retry Mechanism (Duplicate Prevention)
    // ---------------------------------------------------------
    console.log('Testing safe retry mechanism and duplicate prevention...');
    // Retry the failed activity
    const retryResult = await loginNotificationService.retryNotification(failResult.activityId, { email: 'admin@skincheck.local' });
    assert.strictEqual(retryResult.success, true, 'Retry should succeed when provider is operational');

    const updatedAct = loginActivityModel.getById(failResult.activityId);
    assert.strictEqual(updatedAct.wa_notification.status, 'sent', 'Status should now be sent');
    assert.strictEqual(updatedAct.wa_notification.retries, 1, 'Retry count should be 1');

    // Try to retry again when already sent -> must be rejected to prevent duplicate messages!
    const duplicateRetry = await loginNotificationService.retryNotification(failResult.activityId);
    assert.strictEqual(duplicateRetry.success, false, 'Duplicate retry must be rejected when message is already sent');
    assert(duplicateRetry.message.includes('mencegah duplikasi') || duplicateRetry.message.includes('sudah berhasil'), 'Message should explain duplicate prevention');

    // ---------------------------------------------------------
    // 7. Enable / Disable Toggle Setting
    // ---------------------------------------------------------
    console.log('Testing enable/disable toggle setting...');
    systemConfigModel.updateWhatsAppConfig({
        login_notification: { enabled: false }
    });

    mockProvider.clearHistory();
    const disabledResult = await loginNotificationService.notifyLoginSuccess({
        user: testUserWithPhone,
        req: mockHttpReq
    });

    assert.strictEqual(disabledResult.sent, false, 'Notification must not be sent when disabled');
    assert.strictEqual(disabledResult.status, 'disabled', 'Status must be disabled');
    assert.strictEqual(mockProvider.getSentMessages().filter(m => m.type === 'login_notification').length, 0, 'Zero messages dispatched when disabled');

    // Re-enable toggle
    systemConfigModel.updateWhatsAppConfig({
        login_notification: { enabled: true }
    });

    // ---------------------------------------------------------
    // 8. Authentication Integration: Failed login must NOT send notification
    // ---------------------------------------------------------
    console.log('Testing failed authentication does not trigger login notification...');
    mockProvider.clearHistory();

    const dummyRes = {
        render: function(view, data) { this.renderedView = view; this.data = data; },
        redirect: function(url) { this.redirectedTo = url; }
    };

    const failLoginReq = {
        body: { email: 'nonexistent@example.com', password: 'wrongpassword' },
        session: {},
        headers: { 'user-agent': chromeWindowsUA }
    };

    await authController.login(failLoginReq, dummyRes);
    assert.strictEqual(dummyRes.renderedView, 'auth/login', 'Should render login page with error');
    assert.strictEqual(mockProvider.getSentMessages().filter(m => m.type === 'login_notification').length, 0, 'No notification should be sent on failed login attempt');

    // Clean up
    loginActivityModel.deleteByUserId(userAId);
    loginActivityModel.deleteByUserId(userBId);
    loginActivityModel.deleteByUserId(testUserWithPhone.id);
    loginActivityModel.deleteByUserId(testUserNoPhone.id);

    console.log('✔ All WhatsApp Login Notification unit & integration tests passed successfully.');
}

module.exports = runTests;

if (require.main === module) {
    runTests().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
