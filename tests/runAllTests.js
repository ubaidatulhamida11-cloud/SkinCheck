// Load environment configuration
require('../src/config/env');
const { runMigration } = require('../src/database/migrate');

async function main() {
    console.log('====================================================');
    console.log('   SkinCheck WhatsApp OTP - Automated Test Suite    ');
    console.log('====================================================\n');

    // Ensure database migration has initialized tables
    runMigration();

    const suites = [
        { name: 'Phone Normalizer Unit Tests', fn: require('./unit/phoneNormalizer.test') },
        { name: 'OTP Service Core Security Tests', fn: require('./unit/otpService.test') },
        { name: 'WhatsApp Providers (Meta & Mock) Tests', fn: require('./unit/whatsappProvider.test') },
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
