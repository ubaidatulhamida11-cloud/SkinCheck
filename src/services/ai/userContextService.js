const scanModel = require('../../models/scanModel');
const analysisModel = require('../../models/analysisModel');
const sunscreenModel = require('../../models/sunscreenModel');
const userModel = require('../../models/userModel');

/**
 * User Context Service
 * Gathers isolated user data safely to build LLM context.
 */
function buildUserContext(userId, contextType, contextId) {
    let contextString = "--- USER CONTEXT ---\n";

    // 1. User Profile Basics (only relevant stuff)
    const user = userModel.getUserById(userId);
    if (user && user.profile_data) {
        contextString += `Goals: ${user.profile_data.goals?.join(', ')}\n`;
        contextString += `Current Products: ${user.profile_data.products?.join(', ')}\n`;
    }

    // 2. Specific Context (if CTA was clicked from a specific page)
    if (contextType === 'skin_scan' && contextId) {
        const scan = scanModel.getScanById(contextId);
        const analysis = analysisModel.getAnalysisByScanId(contextId);
        if (scan && scan.user_id === userId && analysis) {
            contextString += `\n[FOCUSED CONTEXT: SKIN SCAN]\n`;
            contextString += `Date: ${scan.created_at}\n`;
            contextString += `Overall Score: ${analysis.overall_score}\n`;
            contextString += `Acne: ${analysis.acne_score}, Redness: ${analysis.redness_score}\n`;
        }
    } else if (contextType === 'sunscreen_check' && contextId) {
        const scan = scanModel.getScanById(contextId);
        const sunscreen = sunscreenModel.getScanByScanId(contextId);
        if (scan && scan.user_id === userId && sunscreen) {
            contextString += `\n[FOCUSED CONTEXT: SUNSCREEN CHECK]\n`;
            contextString += `Date: ${scan.created_at}\n`;
            contextString += `Score: ${sunscreen.coverage_score} (${sunscreen.coverage_status})\n`;
            contextString += `Areas: ${sunscreen.low_coverage_areas?.join(', ')}\n`;
        }
    }

    // 3. Database User Statistics
    const stats = userModel.getUserStatistics();
    const adminCount = stats.roles['admin'] || 0;
    const customerCount = stats.roles['customer'] || 0;
    const otherRoles = Object.keys(stats.roles).filter(r => r !== 'admin' && r !== 'customer');

    contextString += `\n[DATABASE USER STATISTICS]\n`;
    contextString += `Total Users in System: ${stats.total}\n`;
    contextString += `Admin Users: ${adminCount}\n`;
    contextString += `Customer Users: ${customerCount}\n`;
    if (otherRoles.length > 0) {
        otherRoles.forEach(r => {
            contextString += `${r.toUpperCase()} Users: ${stats.roles[r]}\n`;
        });
    } else {
        contextString += `Other Roles: 0\n`;
    }
    contextString += `Active Accounts: ${stats.active}, Inactive/Deleted Accounts: ${stats.deleted}\n`;

    contextString += "--------------------\n";
    return contextString;
}

module.exports = {
    buildUserContext
};
