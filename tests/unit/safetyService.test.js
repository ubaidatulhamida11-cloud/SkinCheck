const assert = require('assert');
const { validateInput, validateOutput } = require('../../src/services/ai/safetyService');

function runTests() {
    console.log('--- Testing AI Safety & Guardrails Service ---');

    // 1. Safe skincare questions should pass
    const safeQuery1 = validateInput("Bagaimana cara merawat kulit berjerawat dan berminyak?");
    assert.strictEqual(safeQuery1.isSafe, true, "Safe skincare question should be allowed");

    const safeQuery2 = validateInput("Rekomendasikan pelembab yang cocok untuk kulit kering.");
    assert.strictEqual(safeQuery2.isSafe, true, "Safe product recommendation query should be allowed");

    // 2. High-risk medical emergency keywords should be blocked
    const riskQuery1 = validateInput("Apakah benjolan ini kanker kulit ganas?");
    assert.strictEqual(riskQuery1.isSafe, false, "Cancer keyword should be blocked");
    assert.strictEqual(riskQuery1.reason, 'HIGH_RISK_MEDICAL_KEYWORD');
    assert(riskQuery1.fallbackMessage.includes("dokter kulit"), "Fallback message should advise consulting a doctor");

    const riskQuery2 = validateInput("Tolong beri saya resep obat antibiotik dosis tinggi.");
    assert.strictEqual(riskQuery2.isSafe, false, "Prescription / antibiotic request should be blocked");
    assert.strictEqual(riskQuery2.reason, 'HIGH_RISK_MEDICAL_KEYWORD');

    // 3. Coding and programming keywords should be blocked
    const codingQuery1 = validateInput("Tolong buatkan kode python untuk machine learning.");
    assert.strictEqual(codingQuery1.isSafe, false, "Python coding query should be blocked");
    assert.strictEqual(codingQuery1.reason, 'CODING_QUERY_BLOCKED');
    assert(codingQuery1.fallbackMessage.includes("coding/pemrograman"), "Should explain inability to answer coding");

    const codingQuery2 = validateInput("Bagaimana cara menulis script javascript backend express?");
    assert.strictEqual(codingQuery2.isSafe, false, "JavaScript coding query should be blocked");
    assert.strictEqual(codingQuery2.reason, 'CODING_QUERY_BLOCKED');

    // 4. Empty or non-string inputs should be handled safely
    assert.strictEqual(validateInput(null).isSafe, true, "Null input should be safe");
    assert.strictEqual(validateInput("").isSafe, true, "Empty input should be safe");

    // 5. Output safety validation (prevent clinical diagnostic claims)
    const unsafeOutput = validateOutput("Berdasarkan foto wajah, saya mendiagnosis anda menderita eksim parah.");
    assert.strictEqual(unsafeOutput.isSafe, false, "Diagnostic claim output should be blocked");
    assert(unsafeOutput.fallbackMessage.includes("batasan medis"), "Should provide safety fallback warning");

    const safeOutput = validateOutput("Kulit Anda tampak memiliki kecenderungan berminyak pada zona T. Anda dapat mempertimbangkan pembersih wajah berbahan lembut.");
    assert.strictEqual(safeOutput.isSafe, true, "Educational and non-diagnostic output should be safe");

    console.log('✔ AI Safety & Guardrails unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
