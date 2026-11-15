const assert = require('assert');
const whatsappOtpController = require('../../src/controllers/whatsappOtpController');
const otpChallengeModel = require('../../src/models/otpChallengeModel');
const userModel = require('../../src/models/userModel');
const otpService = require('../../src/services/otpService');
const { setProvider, MockWhatsAppProvider } = require('../../src/services/whatsapp');
const { resetRateLimits } = require('../../src/middleware/rateLimiter');

function createMockReqRes({ body = {}, query = {}, session = {}, headers = {}, method = 'POST' }) {
    const req = {
        body,
        query,
        session,
        headers,
        method,
        socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
        statusCode: 200,
        bodyData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.bodyData = data;
            return this;
        },
        send(data) {
            this.bodyData = data;
            return this;
        }
    };

    return { req, res };
}

async function runTests() {
    console.log('--- Testing API Endpoints (/api/auth/whatsapp/*) ---');

    resetRateLimits();
    const mockProvider = new MockWhatsAppProvider();
    setProvider(mockProvider);

    // 1. Request OTP without phone -> 400
    {
        const { req, res } = createMockReqRes({ body: {} });
        await whatsappOtpController.requestOtp(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.bodyData.error, 'PHONE_REQUIRED');
    }

    // 2. Request OTP with valid phone -> 200
    let challengeId = null;
    const testPhone = '+62812' + Math.floor(1000000 + Math.random() * 9000000);
    {
        const { req, res } = createMockReqRes({
            body: { phone: testPhone, purpose: 'login' }
        });
        await whatsappOtpController.requestOtp(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.bodyData.success, true);
        assert(res.bodyData.challengeId, 'Must return challengeId');
        assert(res.bodyData.maskedPhone, 'Must return maskedPhone');
        challengeId = res.bodyData.challengeId;
    }

    // 3. Resend OTP within cooldown -> 429
    {
        const { req, res } = createMockReqRes({
            body: { challengeId, phone: testPhone, purpose: 'login' }
        });
        await whatsappOtpController.resendOtp(req, res);
        assert.strictEqual(res.statusCode, 429);
        assert.strictEqual(res.bodyData.error, 'COOLDOWN_ACTIVE');
    }

    // 4. Status endpoint -> 200
    {
        const { req, res } = createMockReqRes({
            query: { challengeId }
        });
        await whatsappOtpController.getStatus(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.bodyData.success, true);
        assert.strictEqual(res.bodyData.status, 'pending');
        assert(!res.bodyData.otp_hash, 'NEVER return otp_hash');
    }

    // 5. Verify OTP with missing fields -> 400
    {
        const { req, res } = createMockReqRes({
            body: { challengeId }
        });
        await whatsappOtpController.verifyOtp(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.bodyData.error, 'MISSING_FIELDS');
    }

    // 6. Verify OTP with wrong code -> 400
    {
        const { req, res } = createMockReqRes({
            body: { challengeId, otp: '000000', purpose: 'login', phone: testPhone }
        });
        await whatsappOtpController.verifyOtp(req, res);
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.bodyData.error, 'INVALID_OTP');
    }

    // 7. Verify OTP for phone without registered user -> 404
    {
        const knownOtp = '888888';
        const salt = 'salt_api_test';
        const hash = otpService.hashOtp(knownOtp, salt, testPhone, 'login');
        const unlinkedChallenge = otpChallengeModel.createChallenge({
            phoneNumber: testPhone,
            purpose: 'login',
            otpHash: hash,
            salt,
            expiresInSeconds: 300,
            resendCooldownSeconds: 60,
            maxAttempts: 5
        });

        const { req, res } = createMockReqRes({
            body: { challengeId: unlinkedChallenge.id, otp: knownOtp, purpose: 'login', phone: testPhone }
        });
        await whatsappOtpController.verifyOtp(req, res);
        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.bodyData.error, 'USER_NOT_FOUND');
    }

    // 8. Verify OTP for existing registered user -> 200 and session set
    {
        // Link a test user with a phone number
        const users = userModel.getAllUsers();
        assert(users.length > 0, 'Should have users in database');
        const targetUser = users[0];
        const linkedPhone = '+62812' + Math.floor(1000000 + Math.random() * 9000000);
        userModel.updateUserPhone(targetUser.id, linkedPhone, true);

        const knownOtp = '555555';
        const salt = 'salt_user_test';
        const hash = otpService.hashOtp(knownOtp, salt, linkedPhone, 'login');
        const loginChallenge = otpChallengeModel.createChallenge({
            userId: targetUser.id,
            phoneNumber: linkedPhone,
            purpose: 'login',
            otpHash: hash,
            salt,
            expiresInSeconds: 300,
            resendCooldownSeconds: 60,
            maxAttempts: 5
        });

        const { req, res } = createMockReqRes({
            body: { challengeId: loginChallenge.id, otp: knownOtp, purpose: 'login', phone: linkedPhone }
        });
        await whatsappOtpController.verifyOtp(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.bodyData.success, true);
        assert(res.bodyData.redirectUrl, 'Must return redirectUrl');
        assert(req.session.user, 'Session user must be established');
        assert.strictEqual(req.session.user.id, targetUser.id);
    }

    // 9. Webhook GET verification
    {
        const { req, res } = createMockReqRes({
            query: {
                'hub.mode': 'subscribe',
                'hub.verify_token': process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'skincheck_webhook_secret_verify_token',
                'hub.challenge': 'CHALLENGE_ACCEPTED_12345'
            }
        });
        whatsappOtpController.handleWebhookGet(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.bodyData, 'CHALLENGE_ACCEPTED_12345');
    }

    // 10. Webhook POST delivery receipt callback
    {
        const dummyMsgId = 'wamid.TEST_MSG_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const testCh = otpChallengeModel.createChallenge({
            phoneNumber: '+6281234567899',
            purpose: 'login',
            otpHash: 'dummy',
            providerMessageId: dummyMsgId,
            deliveryStatus: 'sent'
        });

        const { req, res } = createMockReqRes({
            body: {
                object: 'whatsapp_business_account',
                entry: [{
                    changes: [{
                        value: {
                            statuses: [{
                                id: dummyMsgId,
                                status: 'delivered'
                            }]
                        }
                    }]
                }]
            }
        });
        whatsappOtpController.handleWebhookPost(req, res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.bodyData.received, true);

        const updated = otpChallengeModel.getChallengeById(testCh.id);
        assert.strictEqual(updated.delivery_status, 'delivered');
    }

    console.log('✔ API Endpoints integration tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
