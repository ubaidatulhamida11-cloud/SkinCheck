const assert = require('assert');
const authController = require('../../src/controllers/authController');
const userModel = require('../../src/models/userModel');

function createMockReqRes({ body = {}, session = {}, method = 'POST' }) {
    const req = {
        body,
        session,
        method
    };

    const res = {
        statusCode: 200,
        renderedView: null,
        renderData: null,
        redirectUrl: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        render(view, data) {
            this.renderedView = view;
            this.renderData = data;
            return this;
        },
        redirect(url) {
            this.redirectUrl = url;
            return this;
        }
    };

    return { req, res };
}

async function runTests() {
    console.log('--- Testing Regression: Existing Auth (Password & Registration) ---');

    // 1. Existing User Login with Correct Password
    // Check an existing test user in data/users.json
    const users = userModel.getAllUsers();
    assert(users.length > 0, 'Must have users');
    
    // Create a temporary test user for clean regression testing
    const testEmail = `reg_test_${Date.now()}@skincheck.local`;
    const testPassword = 'Password123!';
    const user = await userModel.createUser('Regression Tester', testEmail, testPassword);

    {
        const { req, res } = createMockReqRes({
            body: { email: testEmail, password: testPassword }
        });
        await authController.login(req, res);
        assert(res.redirectUrl, 'Successful login must redirect');
        assert(req.session.user, 'Session user must be populated');
        assert.strictEqual(req.session.user.email, testEmail);
    }

    // 2. Existing User Login with Wrong Password
    {
        const { req, res } = createMockReqRes({
            body: { email: testEmail, password: 'WrongPassword' }
        });
        await authController.login(req, res);
        assert.strictEqual(res.renderedView, 'auth/login');
        assert.strictEqual(res.renderData.error, 'Invalid email or password.');
        assert.strictEqual(req.session.user, undefined, 'Session must not be set on wrong password');
    }

    // 3. User Registration with Mandatory WhatsApp OTP Verification
    const newRegEmail = `new_reg_${Date.now()}@skincheck.local`;
    const regPhone = '+62812' + Math.floor(1000000 + Math.random() * 9000000);
    const session = {};

    {
        // Step A: Submit registration form -> should redirect to OTP verification page
        const { req, res } = createMockReqRes({
            body: {
                name: 'New Registered User',
                email: newRegEmail,
                password: 'SecretPassword123',
                confirmPassword: 'SecretPassword123',
                privacyConsent: 'on',
                dataConsent: 'on',
                phoneNumber: regPhone
            },
            session
        });
        await authController.register(req, res);
        assert.strictEqual(res.redirectUrl, '/auth/register/verify', 'Must redirect to OTP verification page');
        assert(session.pendingRegistration, 'Must store pending registration in session');
        assert.strictEqual(session.pendingRegistration.email, newRegEmail);
        assert.strictEqual(session.pendingRegistration.phoneNumber, regPhone);

        // Step B: Submit wrong OTP -> should fail
        const { req: wrongReq, res: wrongRes } = createMockReqRes({
            body: { otp: '000000' },
            session
        });
        await authController.verifyRegisterOtp(wrongReq, wrongRes);
        assert.strictEqual(wrongRes.renderedView, 'auth/register_verify');
        assert(wrongRes.renderData.error, 'Must show OTP error');

        // Step C: Submit correct OTP -> should verify, create user, and redirect to onboarding
        const mockProvider = require('../../src/services/whatsapp').getProvider();
        const validOtp = mockProvider.getLastOtpForPhone(regPhone);
        assert(validOtp, 'Mock provider must have recorded the sent OTP');

        const { req: verifyReq, res: verifyRes } = createMockReqRes({
            body: { otp: validOtp },
            session
        });
        await authController.verifyRegisterOtp(verifyReq, verifyRes);
        assert.strictEqual(verifyRes.redirectUrl, '/onboarding/1', 'Must redirect to onboarding after successful verification');
        assert(session.user, 'User should be logged in after OTP verification');
        assert.strictEqual(session.user.email, newRegEmail);
        assert.strictEqual(session.user.phone_verified, true, 'Phone must be marked verified');
    }

    // 4. Registration with Mismatched Passwords
    {
        const { req, res } = createMockReqRes({
            body: {
                name: 'Mismatched User',
                email: `mismatch_${Date.now()}@skincheck.local`,
                phoneNumber: '081298765432',
                password: 'PassOne123',
                confirmPassword: 'PassTwo123',
                privacyConsent: 'on',
                dataConsent: 'on'
            }
        });
        await authController.register(req, res);
        assert.strictEqual(res.renderedView, 'auth/register');
        assert.strictEqual(res.renderData.error, 'Konfirmasi kata sandi tidak cocok.');
    }

    // Clean up temporary regression test users
    userModel.hardDeleteUser(user.id);
    const registeredUser = userModel.getAllUsers().find(u => u.email === newRegEmail);
    if (registeredUser) userModel.hardDeleteUser(registeredUser.id);

    console.log('✔ Regression tests passed. Standard password login and registration are preserved.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
