const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../../data/products.json');

function getProducts() {
    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (e) {
        return [];
    }
}

function saveProducts(products) {
    fs.writeFileSync(dataFile, JSON.stringify(products, null, 2), 'utf8');
}

module.exports = {
    getAllActiveProducts() {
        return getProducts().filter(p => p.status === 'active');
    },
    
    getProductById(id) {
        return getProducts().find(p => p.id === id && p.status === 'active');
    },

    getProductByIdAnyStatus(id) {
        return getProducts().find(p => p.id === id);
    },
    
    getProductsByCategory(category) {
        return getProducts().filter(p => p.category.toLowerCase() === category.toLowerCase() && p.status === 'active');
    },

    getAllProducts() {
        return getProducts();
    },

    updateProduct(id, updateData) {
        const products = getProducts();
        const idx = products.findIndex(p => p.id === id);
        if (idx === -1) return null;
        products[idx] = { 
            ...products[idx], 
            ...updateData, 
            updated_at: new Date().toISOString() 
        };
        saveProducts(products);
        return products[idx];
    },

    addProduct(productData) {
        const products = getProducts();
        const newProduct = {
            id: 'prod_' + Date.now(),
            name: productData.name,
            brand: productData.brand || 'SkinCheck Basics',
            category: productData.category || 'Moisturizer',
            description: productData.description || '',
            ingredients: Array.isArray(productData.ingredients) 
                ? productData.ingredients 
                : (typeof productData.ingredients === 'string' ? productData.ingredients.split(',').map(s => s.trim()).filter(Boolean) : []),
            skin_concern: Array.isArray(productData.skin_concern) 
                ? productData.skin_concern 
                : (typeof productData.skin_concern === 'string' ? productData.skin_concern.split(',').map(s => s.trim()).filter(Boolean) : []),
            usage_guidance: productData.usage_guidance || '',
            status: productData.status || 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        products.push(newProduct);
        saveProducts(products);
        return newProduct;
    },

    deleteProduct(id) {
        const products = getProducts();
        const filtered = products.filter(p => p.id !== id);
        if (filtered.length !== products.length) {
            saveProducts(filtered);
            return true;
        }
        return false;
    }
};
