const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataFile = path.join(__dirname, '../../data/otp_challenges.json');

function getChallenges() {
    try {
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, '[]', 'utf8');
            return [];
        }
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[OTP Model] Error reading challenges:', err.message);
        return [];
    }
}

function saveChallenges(challenges) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(challenges, null, 2), 'utf8');
    } catch (err) {
        console.error('[OTP Model] Error saving challenges:', err.message);
        throw err;
    }
}

module.exports = {
    /**
     * Create a new OTP challenge.
     * Invalidates any active challenges for the same phone & purpose.
     */
    createChallenge({
        userId = null,
        phoneNumber,
        purpose = 'login',
        otpHash,
        salt = '',
        expiresInSeconds = 300,
        resendCooldownSeconds = 60,
        maxAttempts = 5,
        deliveryStatus = 'pending',
        providerMessageId = null
    }) {
        const challenges = getChallenges();
        const now = new Date();
        const nowIso = now.toISOString();

        // Invalidate previous active challenges for the same phone & purpose
        challenges.forEach(ch => {
            if (ch.phone_number === phoneNumber && ch.purpose === purpose && ch.status === 'pending') {
                ch.status = 'expired';
                ch.updated_at = nowIso;
            }
        });

        const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
        const resendAvailableAt = new Date(now.getTime() + resendCooldownSeconds * 1000).toISOString();

        const newChallenge = {
            id: 'otp_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
            user_id: userId,
            phone_number: phoneNumber,
            purpose,
            otp_hash: otpHash,
            salt,
            expires_at: expiresAt,
            resend_available_at: resendAvailableAt,
            failed_attempts: 0,
            max_attempts: maxAttempts,
            status: 'pending', // pending, consumed, expired, failed
            consumed_at: null,
            delivery_status: deliveryStatus, // pending, sent, delivered, failed, mocked
            provider_message_id: providerMessageId,
            created_at: nowIso,
            updated_at: nowIso
        };

        challenges.push(newChallenge);
        saveChallenges(challenges);
        return newChallenge;
    },

    getChallengeById(id) {
        const challenges = getChallenges();
        return challenges.find(c => c.id === id) || null;
    },

    findActiveByPhoneAndPurpose(phoneNumber, purpose) {
        const challenges = getChallenges();
        const now = new Date();
        return challenges
            .filter(c => c.phone_number === phoneNumber && c.purpose === purpose && c.status === 'pending')
            .find(c => new Date(c.expires_at) > now) || null;
    },

    findLatestByPhone(phoneNumber) {
        const challenges = getChallenges();
        const matches = challenges.filter(c => c.phone_number === phoneNumber);
        if (matches.length === 0) return null;
        return matches[matches.length - 1];
    },

    incrementFailedAttempts(id) {
        const challenges = getChallenges();
        const challenge = challenges.find(c => c.id === id);
        if (!challenge) return null;

        challenge.failed_attempts = (challenge.failed_attempts || 0) + 1;
        challenge.updated_at = new Date().toISOString();

        if (challenge.failed_attempts >= challenge.max_attempts) {
            challenge.status = 'failed';
        }

        saveChallenges(challenges);
        return challenge;
    },

    /**
     * Atomically consumes a challenge if it is still valid and pending.
     * Prevents race conditions and double-spending.
     */
    consumeChallenge(id) {
        const challenges = getChallenges();
        const challenge = challenges.find(c => c.id === id);
        if (!challenge) return { success: false, reason: 'NOT_FOUND' };

        const now = new Date();

        if (challenge.status !== 'pending') {
            return { success: false, reason: challenge.status.toUpperCase() };
        }

        if (new Date(challenge.expires_at) <= now) {
            challenge.status = 'expired';
            challenge.updated_at = now.toISOString();
            saveChallenges(challenges);
            return { success: false, reason: 'EXPIRED' };
        }

        if (challenge.failed_attempts >= challenge.max_attempts) {
            challenge.status = 'failed';
            challenge.updated_at = now.toISOString();
            saveChallenges(challenges);
            return { success: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
        }

        // Consume atomically
        challenge.status = 'consumed';
        challenge.consumed_at = now.toISOString();
        challenge.updated_at = now.toISOString();
        saveChallenges(challenges);

        return { success: true, challenge };
    },

    updateDeliveryStatus(id, deliveryStatus, providerMessageId = null) {
        const challenges = getChallenges();
        const challenge = challenges.find(c => c.id === id);
        if (challenge) {
            challenge.delivery_status = deliveryStatus;
            if (providerMessageId) {
                challenge.provider_message_id = providerMessageId;
            }
            challenge.updated_at = new Date().toISOString();
            saveChallenges(challenges);
            return challenge;
        }
        return null;
    },

    findChallengeByProviderMessageId(providerMessageId) {
        if (!providerMessageId) return null;
        const challenges = getChallenges();
        return challenges.find(c => c.provider_message_id === providerMessageId) || null;
    },

    getAllChallenges() {
        return getChallenges();
    }
};
