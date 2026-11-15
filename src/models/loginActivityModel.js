const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataFile = path.join(__dirname, '../../data/login_activities.json');

function getActivities() {
    try {
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, JSON.stringify([], null, 2), 'utf8');
            return [];
        }
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('[LoginActivityModel] Error reading file:', err.message);
        return [];
    }
}

function saveActivities(activities) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(activities, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[LoginActivityModel] Error writing file:', err.message);
        return false;
    }
}

function formatIndonesianDateTime(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        });
    } catch (_) {
        return isoString;
    }
}

class LoginActivityModel {
    /**
     * Record a new login activity event
     */
    createActivity({
        userId,
        userName,
        userEmail,
        phoneNumber = null,
        ipAddress = '127.0.0.1',
        device = 'Perangkat Tidak Dikenal',
        browser = 'Browser Tidak Dikenal',
        location = 'Lokal / Jaringan Internal',
        loginMethod = 'password',
        waStatus = 'pending',
        waDetails = {}
    }) {
        const activities = getActivities();
        const now = new Date().toISOString();
        const activityId = 'log_act_' + Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');

        const newRecord = {
            id: activityId,
            user_id: String(userId),
            user_name: userName || 'Pengguna',
            user_email: userEmail || '',
            phone_number: phoneNumber || null,
            timestamp: now,
            formatted_time: formatIndonesianDateTime(now),
            device: device || 'Desktop / PC',
            browser: browser || 'Web Browser',
            ip_address: ipAddress || '127.0.0.1',
            location: location || 'Lokal / Jaringan Internal',
            login_method: loginMethod || 'password',
            wa_notification: {
                enabled: waDetails.enabled !== undefined ? Boolean(waDetails.enabled) : true,
                status: waStatus || 'pending', // 'sent' | 'failed' | 'disabled' | 'no_phone' | 'pending'
                provider: waDetails.provider || null,
                message_id: waDetails.messageId || null,
                error: waDetails.error || null,
                sent_at: waDetails.sentAt || (waStatus === 'sent' ? now : null),
                retries: waDetails.retries || 0,
                last_retry_at: null
            }
        };

        // Prepend so newest is always first
        activities.unshift(newRecord);

        // Cap to latest 2000 records to prevent unbounded memory growth
        if (activities.length > 2000) {
            activities.length = 2000;
        }

        saveActivities(activities);
        return newRecord;
    }

    /**
     * Update WhatsApp notification delivery status
     */
    updateWaNotification(activityId, { status, provider, messageId, error, incrementRetry = false }) {
        const activities = getActivities();
        const index = activities.findIndex(a => a.id === activityId);
        if (index === -1) return null;

        const record = activities[index];
        const now = new Date().toISOString();

        record.wa_notification.status = status;
        if (provider) record.wa_notification.provider = provider;
        if (messageId) record.wa_notification.message_id = messageId;
        if (error !== undefined) record.wa_notification.error = error;
        if (status === 'sent') {
            record.wa_notification.sent_at = now;
            record.wa_notification.error = null;
        }

        if (incrementRetry) {
            record.wa_notification.retries = (record.wa_notification.retries || 0) + 1;
            record.wa_notification.last_retry_at = now;
        }

        saveActivities(activities);
        return record;
    }

    /**
     * Get login activities for a specific user ID strictly.
     * Enforces user isolation so users can ONLY see their own records.
     */
    getByUserId(userId, limit = 20) {
        if (!userId) return [];
        const activities = getActivities();
        return activities
            .filter(a => a.user_id === String(userId))
            .slice(0, limit);
    }

    /**
     * Get single record by ID
     */
    getById(activityId) {
        if (!activityId) return null;
        const activities = getActivities();
        return activities.find(a => a.id === activityId) || null;
    }

    /**
     * Get all login activities (for admin monitoring & logs)
     */
    getAll(limit = 100, filter = {}) {
        let activities = getActivities();

        if (filter.status && filter.status !== 'all') {
            activities = activities.filter(a => a.wa_notification?.status === filter.status);
        }

        if (filter.search && filter.search.trim() !== '') {
            const q = filter.search.toLowerCase().trim();
            activities = activities.filter(a => 
                (a.user_name && a.user_name.toLowerCase().includes(q)) ||
                (a.user_email && a.user_email.toLowerCase().includes(q)) ||
                (a.phone_number && a.phone_number.includes(q)) ||
                (a.ip_address && a.ip_address.includes(q)) ||
                (a.device && a.device.toLowerCase().includes(q))
            );
        }

        return activities.slice(0, limit);
    }

    /**
     * Delete activities for a specific user (e.g. on account deletion)
     */
    deleteByUserId(userId) {
        let activities = getActivities();
        const initial = activities.length;
        activities = activities.filter(a => a.user_id !== String(userId));
        if (activities.length !== initial) {
            saveActivities(activities);
            return true;
        }
        return false;
    }
}

module.exports = new LoginActivityModel();
