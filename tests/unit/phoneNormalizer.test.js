const assert = require('assert');
const { normalizePhoneNumber, isValidE164, maskPhoneNumber } = require('../../src/utils/phoneNormalizer');

function runTests() {
    console.log('--- Testing phoneNormalizer ---');

    // 1. Indonesian local format (08xx -> +628xx)
    const idLocal = normalizePhoneNumber('081234567890');
    assert.strictEqual(idLocal, '+6281234567890', 'Should normalize 08xx to +628xx');

    // 2. Local without 0 (8xx -> +628xx)
    const idNoZero = normalizePhoneNumber('81234567890');
    assert.strictEqual(idNoZero, '+6281234567890', 'Should normalize 8xx to +628xx');

    // 3. Formatted with spaces and dashes
    const formatted = normalizePhoneNumber('+62 812-3456-7890');
    assert.strictEqual(formatted, '+6281234567890', 'Should strip spaces and dashes');

    // 4. International format
    const intl = normalizePhoneNumber('+1 (555) 234-5678');
    assert.strictEqual(intl, '+15552345678', 'Should normalize US number');

    // 5. Invalid numbers
    assert.strictEqual(normalizePhoneNumber(''), null, 'Empty string should return null');
    assert.strictEqual(normalizePhoneNumber('abc'), null, 'Non-digits should return null');
    assert.strictEqual(normalizePhoneNumber('123'), null, 'Too short number should return null');
    assert.strictEqual(normalizePhoneNumber(null), null, 'Null should return null');

    // 6. isValidE164
    assert.strictEqual(isValidE164('+6281234567890'), true, '+6281234567890 should be valid E.164');
    assert.strictEqual(isValidE164('081234567890'), false, '081234567890 should not be raw E.164');
    assert.strictEqual(isValidE164('+0123456'), false, 'Cannot start with +0');

    // 7. maskPhoneNumber
    const masked = maskPhoneNumber('+6281234567890');
    assert(masked.startsWith('+628'), 'Mask should preserve prefix');
    assert(masked.endsWith('890'), 'Mask should preserve suffix');
    assert(masked.includes('*'), 'Mask should contain asterisks');

    console.log('✔ phoneNormalizer tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
