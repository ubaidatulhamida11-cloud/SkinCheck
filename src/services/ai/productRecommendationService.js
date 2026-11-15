const productModel = require('../../models/productModel');

/**
 * Product Recommendation Service
 * Bridges user context and product catalog to find safe, cosmetic candidates.
 */
function getCandidateProducts(userContextString, userQuery) {
    const activeProducts = productModel.getAllActiveProducts();
    const candidates = [];
    const lowerQuery = userQuery.toLowerCase();
    const lowerContext = userContextString.toLowerCase();

    // Very basic matching logic for MVP:
    // If user mentions 'jerawat' or 'acne', find matching products
    // If user mentions 'kering' or 'dry', find matching products
    // If no specific match, just return a general basic routine

    let targetedConcerns = [];
    if (lowerQuery.includes('jerawat') || lowerContext.includes('acne')) {
        targetedConcerns.push('jerawat');
    }
    if (lowerQuery.includes('kering') || lowerContext.includes('dry')) {
        targetedConcerns.push('kering');
    }
    if (lowerQuery.includes('kemerahan') || lowerContext.includes('redness')) {
        targetedConcerns.push('kemerahan');
    }

    if (targetedConcerns.length > 0) {
        // Find products matching concerns
        activeProducts.forEach(product => {
            const matches = product.skin_concern.some(concern => targetedConcerns.includes(concern.toLowerCase()));
            if (matches) {
                candidates.push(product);
            }
        });
    }

    // Fallback or general query: provide basics (Cleanser, Moisturizer, Sunscreen)
    if (candidates.length === 0) {
        activeProducts.forEach(product => {
            if (['cleanser', 'moisturizer', 'sunscreen'].includes(product.category.toLowerCase())) {
                candidates.push(product);
            }
        });
    }

    // Limit to max 3 candidates to avoid overwhelming the user/LLM
    return candidates.slice(0, 3);
}

module.exports = {
    getCandidateProducts
};
