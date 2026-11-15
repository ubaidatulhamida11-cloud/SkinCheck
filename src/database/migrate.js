const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
const usersFile = path.join(dataDir, 'users.json');
const otpFile = path.join(dataDir, 'otp_challenges.json');

function runMigration() {
    console.log('[Migration] Starting database migration for WhatsApp OTP...');

    // 1. Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // 2. Migrate users.json
    if (fs.existsSync(usersFile)) {
        try {
            const raw = fs.readFileSync(usersFile, 'utf8');
            const users = JSON.parse(raw);
            let updated = false;

            users.forEach(user => {
                if (user.phone_number === undefined) {
                    user.phone_number = null;
                    updated = true;
                }
                if (user.phone_verified === undefined) {
                    user.phone_verified = false;
                    updated = true;
                }
            });

            if (updated) {
                fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
                console.log(`[Migration] Updated ${users.length} users with phone fields.`);
            } else {
                console.log('[Migration] Users table already up to date.');
            }
        } catch (err) {
            console.error('[Migration] Failed to migrate users.json:', err.message);
        }
    } else {
        fs.writeFileSync(usersFile, JSON.stringify([], null, 2), 'utf8');
        console.log('[Migration] Initialized empty users.json.');
    }

    // 3. Ensure otp_challenges.json exists
    if (!fs.existsSync(otpFile)) {
        fs.writeFileSync(otpFile, JSON.stringify([], null, 2), 'utf8');
        console.log('[Migration] Initialized otp_challenges.json storage.');
    } else {
        console.log('[Migration] otp_challenges.json already exists.');
    }

    // 4. Ensure login_activities.json exists
    const loginActivitiesFile = path.join(dataDir, 'login_activities.json');
    if (!fs.existsSync(loginActivitiesFile)) {
        fs.writeFileSync(loginActivitiesFile, JSON.stringify([], null, 2), 'utf8');
        console.log('[Migration] Initialized login_activities.json storage.');
    } else {
        console.log('[Migration] login_activities.json already exists.');
    }

    console.log('[Migration] Database migration completed successfully.');
}

if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
