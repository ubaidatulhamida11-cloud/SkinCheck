const assert = require('assert');
const { analyzeSkin } = require('../../src/services/skinAnalysisService');

async function runTests() {
    console.log('--- Testing Skin Analysis Service ---');

    // 1. Analyze with mock fallback (non-existent image path)
    const result = await analyzeSkin('test_scan_123', 'non_existent_image.jpg');

    // 2. Validate return structure
    assert(result !== null && typeof result === 'object', 'Analysis result must be an object');
    assert(typeof result.acne_score === 'number', 'acne_score must be a number');
    assert(typeof result.redness_score === 'number', 'redness_score must be a number');
    assert(typeof result.texture_score === 'number', 'texture_score must be a number');
    assert(typeof result.hyperpigmentation_score === 'number', 'hyperpigmentation_score must be a number');
    assert(typeof result.overall_score === 'number', 'overall_score must be a number');

    // 3. Score range validations (0 - 100)
    assert(result.acne_score >= 0 && result.acne_score <= 100, 'acne_score must be between 0 and 100');
    assert(result.redness_score >= 0 && result.redness_score <= 100, 'redness_score must be between 0 and 100');
    assert(result.texture_score >= 0 && result.texture_score <= 100, 'texture_score must be between 0 and 100');
    assert(result.hyperpigmentation_score >= 0 && result.hyperpigmentation_score <= 100, 'hyperpigmentation_score must be between 0 and 100');
    assert(result.overall_score >= 0 && result.overall_score <= 100, 'overall_score must be between 0 and 100');

    // 4. Overall score should match arithmetic average calculation
    const expectedAverage = Math.floor((result.acne_score + result.redness_score + result.texture_score + result.hyperpigmentation_score) / 4);
    assert.strictEqual(result.overall_score, expectedAverage, 'overall_score should equal average of metrics');

    // 5. Check valid analysis method
    assert(['mobilenetv2_tfjs', 'mock_cv_v1'].includes(result.analysis_method), 'analysis_method must be valid');

    console.log('✔ Skin Analysis unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
