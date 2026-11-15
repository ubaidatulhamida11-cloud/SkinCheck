const productModel = require('../models/productModel');

exports.listProducts = (req, res) => {
    const categoryFilter = req.query.category || null;
    let products = productModel.getAllActiveProducts();

    if (categoryFilter) {
        products = products.filter(p => p.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    res.render('customer/layout', {
        page: 'products',
        title: 'Katalog Produk',
        products: products,
        currentCategory: categoryFilter
    });
};

exports.getProductDetail = (req, res) => {
    const productId = req.params.id;
    const product = productModel.getProductById(productId);

    if (!product) {
        return res.status(404).render('error', { message: 'Produk tidak ditemukan atau tidak aktif.' });
    }

    res.render('customer/layout', {
        page: 'product_detail',
        title: product.name,
        product: product
    });
};
