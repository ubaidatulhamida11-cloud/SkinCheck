const express = require('express');
const router = express.Router();
const whatsappOtpController = require('../controllers/whatsappOtpController');
const { rateLimitOtpRequest } = require('../middleware/rateLimiter');

// WhatsApp OTP Endpoints
router.post('/whatsapp/request-otp', rateLimitOtpRequest, whatsappOtpController.requestOtp);
router.post('/whatsapp/resend-otp', rateLimitOtpRequest, whatsappOtpController.resendOtp);
router.post('/whatsapp/verify-otp', whatsappOtpController.verifyOtp);
router.get('/whatsapp/status', whatsappOtpController.getStatus);

// Meta WhatsApp Webhook endpoints
router.get('/whatsapp/webhook', whatsappOtpController.handleWebhookGet);
router.post('/whatsapp/webhook', whatsappOtpController.handleWebhookPost);

module.exports = router;
