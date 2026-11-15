const fs = require('fs');
const path = require('path');

// Load environment configuration
require('../src/config/env');
const { runMigration } = require('../src/database/migrate');

async function main() {
    console.log('====================================================');
    console.log('          SkinCheck - Automated Test Suite          ');
    console.log('====================================================\n');

    // Ensure database migration has initialized tables
    runMigration();

    // Ensure seed data exists for tests in fresh/CI environments
    const dataDir = path.join(__dirname, '../data');
    const usersFile = path.join(dataDir, 'users.json');
    const usersExample = path.join(dataDir, 'users.example.json');
    if (!fs.existsSync(usersFile) || (fs.existsSync(usersFile) && JSON.parse(fs.readFileSync(usersFile, 'utf8') || '[]').length === 0)) {
        if (fs.existsSync(usersExample)) {
            fs.copyFileSync(usersExample, usersFile);
            console.log('[Test Setup] Initialized users.json from users.example.json');
        }
    }

    const configFilePath = path.join(dataDir, 'system_config.json');
    const configExample = path.join(dataDir, 'system_config.example.json');
    if (!fs.existsSync(configFilePath)) {
        if (fs.existsSync(configExample)) {
            fs.copyFileSync(configExample, configFilePath);
            console.log('[Test Setup] Initialized system_config.json from system_config.example.json');
        }
    }

    const suites = [
        { name: 'Phone Normalizer Unit Tests', fn: require('./unit/phoneNormalizer.test') },
        { name: 'OTP Service Core Security Tests', fn: require('./unit/otpService.test') },
        { name: 'WhatsApp Providers (Meta & Mock) Tests', fn: require('./unit/whatsappProvider.test') },
        { name: 'AI Safety & Guardrails Service Tests', fn: require('./unit/safetyService.test') },
        { name: 'Skin Analysis (Computer Vision / Mock) Tests', fn: require('./unit/skinAnalysis.test') },
        { name: 'Sunscreen Analysis Service Tests', fn: require('./unit/sunscreenAnalysis.test') },
        { name: 'Product Model & Catalog Service Tests', fn: require('./unit/productModel.test') },
        { name: 'WhatsApp OTP API Endpoints Integration Tests', fn: require('./integration/apiEndpoints.test') },
        { name: 'Existing Auth Regression Tests', fn: require('./integration/regressionAuth.test') },
        { name: 'System Configuration & Super Admin Tests', fn: require('./integration/systemConfig.test') },
        { name: 'WhatsApp Login Activity Notification Tests', fn: require('./unit/loginNotification.test') }
    ];

    let passed = 0;
    let failed = 0;
    const errors = [];

    for (const suite of suites) {
        try {
            console.log(`\n▶ Running: ${suite.name}`);
            await suite.fn();
            passed++;
        } catch (err) {
            failed++;
            console.error(`✖ FAILED: ${suite.name}`);
            console.error(err);
            errors.push({ suite: suite.name, error: err });
        }
    }

    console.log('\n====================================================');
    console.log(`Test Execution Summary:`);
    console.log(`  Total Suites: ${suites.length}`);
    console.log(`  Passed:       ${passed}`);
    console.log(`  Failed:       ${failed}`);
    console.log('====================================================');

    if (failed > 0) {
        console.error('\nTests completed with failures.');
        process.exit(1);
    } else {
        console.log('\n✔ All tests completed successfully!');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
});
