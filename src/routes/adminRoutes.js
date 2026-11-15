const express = require('express');
const router = express.Router();
const { requireAdmin, requireSuperAdmin } = require('../middleware/authMiddleware');
const userModel = require('../models/userModel');
const productModel = require('../models/productModel');
const aiModel = require('../models/aiModel');
const systemConfigController = require('../controllers/systemConfigController');

// Apply admin protection to all admin routes
router.use(requireAdmin);

router.get('/dashboard', (req, res) => {
    const stats = userModel.getUserStatistics();
    const products = productModel.getAllProducts();
    const allUsers = userModel.getAllUsers();
    const recentCustomerChats = aiModel.getCustomerChatSummaryList().slice(0, 5);
    const totalChatMessages = aiModel.getTotalMessagesCount();
    
    res.render('admin/layout', { 
        page: 'dashboard', 
        title: 'Admin Dashboard',
        stats,
        users: allUsers,
        products,
        recentCustomerChats,
        totalChatMessages
    });
});

router.get('/users', (req, res) => {
    const stats = userModel.getUserStatistics();
    const allUsers = userModel.getAllUsers();
    const activeRoleFilter = (req.query.role || 'all').toLowerCase();
    
    res.render('admin/layout', { 
        page: 'users', 
        title: 'Manage Users',
        stats,
        users: allUsers,
        activeRoleFilter
    });
});

router.get('/products', (req, res) => {
    const products = productModel.getAllProducts();
    res.render('admin/layout', { 
        page: 'products', 
        title: 'Products Management',
        products
    });
});

router.get('/monitoring', (req, res) => {
    res.render('admin/layout', { 
        page: 'monitoring', 
        title: 'Analysis Monitoring' 
    });
});

// Chatbot History Admin Routes
router.get('/chat-history', (req, res) => {
    const chatHistoryList = aiModel.getCustomerChatSummaryList();
    const totalMessages = aiModel.getTotalMessagesCount();
    
    res.render('admin/layout', {
        page: 'chat_history',
        title: 'Riwayat Chatbot Customer',
        chatHistoryList,
        totalMessages
    });
});

router.get('/api/chat-history/:conversationId', (req, res) => {
    const { conversationId } = req.params;
    const detail = aiModel.getConversationDetail(conversationId);
    if (!detail) {
        return res.status(404).json({ success: false, message: 'Percakapan tidak ditemukan' });
    }
    res.json({ success: true, conversation: detail });
});

router.post('/api/chat-history/:conversationId/delete', (req, res) => {
    const { conversationId } = req.params;
    aiModel.deleteConversation(conversationId);
    res.json({ success: true, message: 'Riwayat percakapan berhasil dihapus' });
});

// Chatbot Widget Routes for Admin
const aiController = require('../controllers/aiController');
router.post('/api/chatbot-widget', aiController.sendWidgetMessage);
router.post('/api/chatbot-widget/clear', aiController.clearChatHistory);

router.get('/logs', (req, res) => {
    res.render('admin/layout', { 
        page: 'logs', 
        title: 'Activity Logs' 
    });
});

router.get('/settings', (req, res) => {
    res.redirect('/admin/config/ai');
});

// ==========================================
// SYSTEM CONFIGURATION (SUPER ADMIN PROTECTED)
// ==========================================

// 1. AI Configuration
router.get('/config/ai', requireSuperAdmin, (req, res) => systemConfigController.renderAiConfigPage(req, res));
router.post('/config/ai', requireSuperAdmin, (req, res) => systemConfigController.updateAiConfig(req, res));
router.post('/config/ai/test', requireSuperAdmin, (req, res) => systemConfigController.testAiConnection(req, res));

// 2. WhatsApp OTP & Login Notification Configuration
router.get('/config/whatsapp', requireSuperAdmin, (req, res) => systemConfigController.renderWhatsAppConfigPage(req, res));
router.post('/config/whatsapp', requireSuperAdmin, (req, res) => systemConfigController.updateWhatsAppConfig(req, res));
router.post('/config/whatsapp/test', requireSuperAdmin, (req, res) => systemConfigController.testWhatsAppConnection(req, res));
router.post('/config/whatsapp/retry-login-notification/:id', requireSuperAdmin, (req, res) => systemConfigController.retryLoginNotification(req, res));

// 3. Integration Status
router.get('/config/integrations', requireSuperAdmin, (req, res) => systemConfigController.renderIntegrationsPage(req, res));
router.get('/config/integrations/api', requireSuperAdmin, (req, res) => systemConfigController.getIntegrationHealthApi(req, res));

// 4. Audit Log
router.get('/config/audit-logs', requireSuperAdmin, (req, res) => systemConfigController.renderAuditLogsPage(req, res));

// API: Get single user for Edit modal
router.get('/api/users/:id', (req, res) => {
    const user = userModel.getUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    res.json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role || 'customer',
            status: user.status || 'active',
            phone_number: user.phone_number || null,
            phone_verified: Boolean(user.phone_verified)
        }
    });
});

const auditLogModel = require('../models/auditLogModel');

// Action: Edit user
router.post('/users/:id/edit', (req, res) => {
    const { id } = req.params;
    const { name, email, role, status, phone_number, phone_verified } = req.body;

    const user = userModel.getUserById(id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi' });
    }

    // Check if email already used by someone else
    const allUsers = userModel.getAllUsers();
    const existing = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== id);
    if (existing) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh pengguna lain' });
    }

    const updateData = {
        name,
        email,
        role: role || user.role,
        status: status || user.status
    };

    if (phone_number !== undefined) {
        updateData.phone_number = phone_number ? phone_number.trim() : null;
    }
    if (phone_verified !== undefined) {
        updateData.phone_verified = Boolean(phone_verified);
    }

    const updated = userModel.updateUser(id, updateData);

    // If updated current session admin, update session
    if (req.session.user && req.session.user.id === id) {
        req.session.user = { ...req.session.user, ...updated };
    }

    auditLogModel.addLog({
        category: 'USER_MANAGEMENT',
        action: `Admin memperbarui data pengguna: ${updated.name} (${updated.email})`,
        status: 'SUCCESS',
        details: { userId: id, name: updated.name, role: updated.role, status: updated.status, phone_number: updated.phone_number },
        user: req.session.user
    });

    if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
        return res.json({ success: true, message: 'Data pengguna berhasil diperbarui dan disinkronkan ke chatbot AI.', user: updated });
    }
    res.redirect('/admin/users');
});

// Action: Create user
router.post('/users/create', async (req, res) => {
    try {
        const { name, email, password, role, status, phone_number, phone_verified } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Nama, email, dan kata sandi wajib diisi.' });
        }
        const existing = userModel.getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email sudah terdaftar pada pengguna lain.' });
        }

        const newUser = await userModel.createUser(
            name.trim(), 
            email.trim().toLowerCase(), 
            password, 
            phone_number ? phone_number.trim() : null, 
            Boolean(phone_verified)
        );

        const updateData = {};
        if (role && role !== 'customer') updateData.role = role;
        if (status && status !== 'active') updateData.status = status;
        if (Object.keys(updateData).length > 0) {
            userModel.updateUser(newUser.id, updateData);
            Object.assign(newUser, updateData);
        }

        auditLogModel.addLog({
            category: 'USER_MANAGEMENT',
            action: `Admin menambahkan pengguna baru: ${newUser.name} (${newUser.email}) sebagai ${newUser.role}`,
            status: 'SUCCESS',
            details: { userId: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, status: newUser.status },
            user: req.session.user
        });

        if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
            return res.json({ success: true, message: 'Pengguna baru berhasil ditambahkan ke database dan disinkronkan ke chatbot AI.', user: newUser });
        }
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Error creating user:', err);
        return res.status(500).json({ success: false, message: err.message || 'Gagal menambahkan pengguna baru' });
    }
});

// Action: Delete user
router.post('/users/:id/delete', (req, res) => {
    const { id } = req.params;
    
    // Safety check: Cannot delete own logged-in admin account
    if (req.session.user && req.session.user.id === id) {
        return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang login.' });
    }

    const user = userModel.getUserById(id);
    if (!user) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    // Completely remove user from database
    const deleted = userModel.hardDeleteUser(id);
    if (deleted) {
        auditLogModel.addLog({
            category: 'USER_MANAGEMENT',
            action: `Admin menghapus pengguna: ${user.name} (${user.email})`,
            status: 'SUCCESS',
            details: { userId: id, name: user.name, email: user.email },
            user: req.session.user
        });

        if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
            return res.json({ success: true, message: 'Pengguna berhasil dihapus dari sistem database dan disinkronkan ke chatbot AI.' });
        }
        res.redirect('/admin/users');
    } else {
        res.status(500).json({ success: false, message: 'Gagal menghapus pengguna' });
    }
});

// Action: Add product
router.post('/products/add', (req, res) => {
    const { name, brand, category, skin_concern, description, usage_guidance, ingredients, status } = req.body;
    if (!name || !category) {
        return res.status(400).json({ success: false, message: 'Nama produk dan kategori wajib diisi' });
    }
    const newProduct = productModel.addProduct({
        name, brand, category, skin_concern, description, usage_guidance, ingredients, status
    });
    auditLogModel.addLog({
        category: 'CATALOG_MANAGEMENT',
        action: `Admin menambahkan produk baru: ${newProduct.name} (${newProduct.category})`,
        status: 'SUCCESS',
        details: { productId: newProduct.id, name: newProduct.name, category: newProduct.category },
        user: req.session.user
    });
    if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
        return res.json({ success: true, message: 'Produk baru berhasil ditambahkan dan disinkronkan ke chatbot AI.', product: newProduct });
    }
    res.redirect('/admin/products');
});

// Action: Edit product
router.post('/products/:id/edit', (req, res) => {
    const { id } = req.params;
    const { name, brand, category, skin_concern, description, usage_guidance, ingredients, status } = req.body;
    const product = productModel.getProductByIdAnyStatus(id);
    if (!product) {
        return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    const updateData = {};
    if (name) updateData.name = name;
    if (brand !== undefined) updateData.brand = brand;
    if (category) updateData.category = category;
    if (skin_concern !== undefined) {
        updateData.skin_concern = Array.isArray(skin_concern) ? skin_concern : skin_concern.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (description !== undefined) updateData.description = description;
    if (usage_guidance !== undefined) updateData.usage_guidance = usage_guidance;
    if (ingredients !== undefined) {
        updateData.ingredients = Array.isArray(ingredients) ? ingredients : ingredients.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (status) updateData.status = status;

    const updated = productModel.updateProduct(id, updateData);
    auditLogModel.addLog({
        category: 'CATALOG_MANAGEMENT',
        action: `Admin memperbarui data produk: ${updated.name} (${updated.category})`,
        status: 'SUCCESS',
        details: { productId: id, name: updated.name, category: updated.category, status: updated.status },
        user: req.session.user
    });
    if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
        return res.json({ success: true, message: 'Data produk berhasil diperbarui dan disinkronkan ke chatbot AI.', product: updated });
    }
    res.redirect('/admin/products');
});

// Action: Delete product
router.post('/products/:id/delete', (req, res) => {
    const { id } = req.params;
    const product = productModel.getProductByIdAnyStatus(id);
    if (!product) {
        return res.status(404).json({ success: false, message: 'Produk tidak ditemukan' });
    }
    const deleted = productModel.deleteProduct(id);
    if (deleted) {
        auditLogModel.addLog({
            category: 'CATALOG_MANAGEMENT',
            action: `Admin menghapus produk dari katalog: ${product.name}`,
            status: 'SUCCESS',
            details: { productId: id, name: product.name },
            user: req.session.user
        });
        if (req.xhr || req.headers.accept?.includes('json') || req.is('json')) {
            return res.json({ success: true, message: 'Produk berhasil dihapus dari katalog dan disinkronkan ke chatbot AI.' });
        }
        res.redirect('/admin/products');
    } else {
        res.status(500).json({ success: false, message: 'Gagal menghapus produk' });
    }
});

module.exports = router;