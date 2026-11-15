const assert = require('assert');
const otpService = require('../../src/services/otpService');
const otpChallengeModel = require('../../src/models/otpChallengeModel');
const { setProvider, MockWhatsAppProvider } = require('../../src/services/whatsapp');

async function runTests() {
    console.log('--- Testing otpService (Core OTP Security & Lifecycle) ---');

    // Ensure mock provider is active for unit tests
    const mockProvider = new MockWhatsAppProvider();
    setProvider(mockProvider);

    const testPhone = '+62899' + Math.floor(1000000 + Math.random() * 9000000);

    // 1. Test OTP Generation
    const otp1 = otpService.generateSecureOtp();
    assert.strictEqual(typeof otp1, 'string', 'OTP must be a string');
    assert.strictEqual(otp1.length, 6, 'OTP length must be 6 digits');
    assert(/^\d{6}$/.test(otp1), 'OTP must be numeric');

    // 2. Test Invalid Phone Number rejection
    const invalidPhoneRes = await otpService.requestOtp({
        rawPhone: 'invalid-phone-number',
        purpose: 'login'
    });
    assert.strictEqual(invalidPhoneRes.success, false, 'Invalid phone must be rejected');
    assert.strictEqual(invalidPhoneRes.error, 'INVALID_PHONE_NUMBER');

    // 3. Test Invalid Purpose rejection
    const invalidPurposeRes = await otpService.requestOtp({
        rawPhone: testPhone,
        purpose: 'hacked_purpose'
    });
    assert.strictEqual(invalidPurposeRes.success, false, 'Invalid purpose must be rejected');
    assert.strictEqual(invalidPurposeRes.error, 'INVALID_PURPOSE');

    // 4. Test Successful OTP Request
    const requestRes = await otpService.requestOtp({
        rawPhone: testPhone,
        purpose: 'login'
    });
    assert.strictEqual(requestRes.success, true, 'OTP request should succeed');
    assert(requestRes.challengeId, 'Must return challengeId');
    assert(!requestRes.otp, 'NEVER expose plaintext OTP in response');

    // Inspect stored challenge in database
    const challenge = otpChallengeModel.getChallengeById(requestRes.challengeId);
    assert(challenge, 'Challenge must exist in database');
    assert.strictEqual(challenge.phone_number, testPhone);
    assert.strictEqual(challenge.status, 'pending');
    assert(challenge.otp_hash, 'Must have otp_hash');
    assert.strictEqual(challenge.otp, undefined, 'Plaintext OTP must NEVER be stored');

    // 5. Test Resend Cooldown Enforcement
    const cooldownRes = await otpService.requestOtp({
        rawPhone: testPhone,
        purpose: 'login'
    });
    assert.strictEqual(cooldownRes.success, false, 'Subsequent request within cooldown must fail');
    assert.strictEqual(cooldownRes.error, 'COOLDOWN_ACTIVE');
    assert(cooldownRes.cooldownSeconds > 0, 'Must report remaining cooldown');

    // 6. Test Incorrect OTP Verification
    const wrongVerify = await otpService.verifyOtp({
        challengeId: challenge.id,
        otpCode: '000000',
        purpose: 'login',
        rawPhone: testPhone
    });
    assert.strictEqual(wrongVerify.success, false, 'Wrong OTP must fail');
    assert.strictEqual(wrongVerify.error, 'INVALID_OTP');
    assert.strictEqual(wrongVerify.remainingAttempts, 4, 'Remaining attempts must decrement');

    // Check attempt counter in database
    const updatedChallenge = otpChallengeModel.getChallengeById(challenge.id);
    assert.strictEqual(updatedChallenge.failed_attempts, 1);

    // 7. Test Maximum Failed Attempts
    for (let i = 0; i < 4; i++) {
        await otpService.verifyOtp({
            challengeId: challenge.id,
            otpCode: '111111',
            purpose: 'login',
            rawPhone: testPhone
        });
    }
    const lockedChallenge = otpChallengeModel.getChallengeById(challenge.id);
    assert.strictEqual(lockedChallenge.status, 'failed', 'Challenge must lock to failed status');

    const lockedVerify = await otpService.verifyOtp({
        challengeId: challenge.id,
        otpCode: '999999',
        purpose: 'login',
        rawPhone: testPhone
    });
    assert.strictEqual(lockedVerify.success, false);
    assert.strictEqual(lockedVerify.error, 'MAX_ATTEMPTS_EXCEEDED');

    // 8. Test Successful Verification
    // Manually create a fresh challenge with known OTP for deterministic verification test
    const testOtp = '765432';
    const testSalt = 'salt_abc_123';
    const testHash = otpService.hashOtp(testOtp, testSalt, testPhone, 'login');
    const freshChallenge = otpChallengeModel.createChallenge({
        phoneNumber: testPhone,
        purpose: 'login',
        otpHash: testHash,
        salt: testSalt,
        expiresInSeconds: 300,
        resendCooldownSeconds: 60,
        maxAttempts: 5
    });

    const successVerify = await otpService.verifyOtp({
        challengeId: freshChallenge.id,
        otpCode: testOtp,
        purpose: 'login',
        rawPhone: testPhone
    });
    assert.strictEqual(successVerify.success, true, 'Correct OTP should verify successfully');
    assert.strictEqual(successVerify.challenge.status, 'consumed');
    assert(successVerify.challenge.consumed_at, 'Must set consumed_at timestamp');

    // 9. Test Reused OTP Prevention
    const reuseVerify = await otpService.verifyOtp({
        challengeId: freshChallenge.id,
        otpCode: testOtp,
        purpose: 'login',
        rawPhone: testPhone
    });
    assert.strictEqual(reuseVerify.success, false, 'Reusing consumed OTP must fail');
    assert.strictEqual(reuseVerify.error, 'ALREADY_CONSUMED');

    // 10. Test Expired OTP
    const expiredChallenge = otpChallengeModel.createChallenge({
        phoneNumber: testPhone,
        purpose: 'login',
        otpHash: testHash,
        salt: testSalt,
        expiresInSeconds: -10, // already expired
        resendCooldownSeconds: 60,
        maxAttempts: 5
    });
    const expiredVerify = await otpService.verifyOtp({
        challengeId: expiredChallenge.id,
        otpCode: testOtp,
        purpose: 'login',
        rawPhone: testPhone
    });
    assert.strictEqual(expiredVerify.success, false, 'Expired OTP must fail');
    assert.strictEqual(expiredVerify.error, 'OTP_EXPIRED');

    // 11. Test Purpose Isolation (login vs phone_link)
    const purposeChallenge = otpChallengeModel.createChallenge({
        phoneNumber: testPhone,
        purpose: 'login',
        otpHash: testHash,
        salt: testSalt,
        expiresInSeconds: 300,
        resendCooldownSeconds: 60,
        maxAttempts: 5
    });
    const purposeVerify = await otpService.verifyOtp({
        challengeId: purposeChallenge.id,
        otpCode: testOtp,
        purpose: 'phone_link', // Mismatched purpose!
        rawPhone: testPhone
    });
    assert.strictEqual(purposeVerify.success, false, 'Cross-purpose verification must fail');
    assert.strictEqual(purposeVerify.error, 'PURPOSE_MISMATCH');

    // 12. Test Cross-User Isolation (Mismatched phone number)
    const crossPhoneVerify = await otpService.verifyOtp({
        challengeId: purposeChallenge.id,
        otpCode: testOtp,
        purpose: 'login',
        rawPhone: '+628111111111' // Different phone number!
    });
    assert.strictEqual(crossPhoneVerify.success, false, 'Cross-phone verification must fail');
    assert.strictEqual(crossPhoneVerify.error, 'PHONE_MISMATCH');

    console.log('✔ otpService unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
