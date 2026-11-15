const assert = require('assert');
const productModel = require('../../src/models/productModel');

function runTests() {
    console.log('--- Testing Product Model & Catalog Service ---');

    // 1. Fetch all active products
    const activeProducts = productModel.getAllActiveProducts();
    assert(Array.isArray(activeProducts), 'Active products should return an array');
    assert(activeProducts.length > 0, 'Catalog should contain active products');

    const firstProduct = activeProducts[0];
    assert(typeof firstProduct.id === 'string', 'Product ID should be a string');
    assert(typeof firstProduct.name === 'string', 'Product name should be a string');
    assert(typeof firstProduct.category === 'string', 'Product category should be a string');
    assert(Array.isArray(firstProduct.ingredients), 'Product ingredients should be an array');

    // 2. Fetch product by ID
    const found = productModel.getProductById(firstProduct.id);
    assert(found !== undefined && found !== null, 'Product should be found by its valid ID');
    assert.strictEqual(found.id, firstProduct.id, 'Found product ID must match');

    // 3. Fetch product by non-existent ID
    const notFound = productModel.getProductById('non_existent_product_xyz_123');
    assert.strictEqual(notFound, undefined, 'Non-existent product ID should return undefined');

    // 4. Filter products by category
    const cleansers = productModel.getProductsByCategory('Cleanser');
    assert(Array.isArray(cleansers), 'Category filter should return an array');
    cleansers.forEach(p => {
        assert.strictEqual(p.category.toLowerCase(), 'cleanser', 'Each filtered product category must be Cleanser');
    });

    console.log('✔ Product Model & Catalog unit tests passed.');
}

if (require.main === module) {
    runTests();
}

module.exports = runTests;
