const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../../data/audit_logs.json');

function ensureFileExists() {
    if (!fs.existsSync(logFilePath)) {
        fs.writeFileSync(logFilePath, JSON.stringify([], null, 2), 'utf8');
    }
}

function getLogs(limit = 100) {
    ensureFileExists();
    try {
        const raw = fs.readFileSync(logFilePath, 'utf8');
        const logs = JSON.parse(raw);
        if (!Array.isArray(logs)) return [];
        // Sort descending by timestamp
        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
    } catch (e) {
        console.error('[AuditLog] Error reading audit logs:', e.message);
        return [];
    }
}

function addLog({ category, action, status = 'SUCCESS', details = null, user = null }) {
    ensureFileExists();
    try {
        const raw = fs.readFileSync(logFilePath, 'utf8');
        const logs = JSON.parse(raw) || [];

        const newLog = {
            id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            user_name: user ? (user.name || 'Admin') : 'Super Admin / System',
            user_email: user ? (user.email || 'admin@skincheck.local') : 'system@skincheck.local',
            category: category || 'SYSTEM',
            action: action || 'Configuration modified',
            status: status || 'SUCCESS',
            details: typeof details === 'object' ? JSON.stringify(details) : (details || '')
        };

        logs.push(newLog);

        // Keep last 300 logs
        const trimmed = logs.slice(-300);
        fs.writeFileSync(logFilePath, JSON.stringify(trimmed, null, 2), 'utf8');
        return newLog;
    } catch (e) {
        console.error('[AuditLog] Error writing audit log:', e.message);
        return null;
    }
}

module.exports = {
    getLogs,
    addLog
};
