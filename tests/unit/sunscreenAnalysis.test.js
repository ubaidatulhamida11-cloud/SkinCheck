const assert = require('assert');
const { analyzeSunscreen } = require('../../src/services/sunscreenAnalysisService');

async function runTests() {
    console.log('--- Testing Sunscreen Analysis Service ---');

    // 1. Analyze mock sunscreen image
    const result = await analyzeSunscreen('test_sunscreen_123', 'mock_path.jpg');

    // 2. Validate return structure
    assert(result !== null && typeof result === 'object', 'Sunscreen result must be an object');
    assert(typeof result.coverage_score === 'number', 'coverage_score must be a number');
    assert(typeof result.coverage_status === 'string', 'coverage_status must be a string');
    assert(Array.isArray(result.low_coverage_areas), 'low_coverage_areas must be an array');

    // 3. Score range validations (0 - 100)
    assert(result.coverage_score >= 0 && result.coverage_score <= 100, 'coverage_score must be between 0 and 100');

    // 4. Validate coverage status category
    const validStatuses = ["Relatif Merata", "Cukup Merata", "Perlu Perhatian"];
    assert(validStatuses.includes(result.coverage_status), `Status must be one of ${validStatuses.join(', ')}`);

    // 5. Method and hardware metadata
    assert.strictEqual(result.analysis_method, 'rgb_visual_estimation', 'analysis_method should be rgb_visual_estimation');
    assert.strictEqual(result.hardware_type, 'standard_rgb', 'hardware_type should be standard_rgb');

    console.log('✔ Sunscreen Analysis unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
