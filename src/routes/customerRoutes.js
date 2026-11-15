const express = require('express');
const router = express.Router();
const { requireAuth, requireOnboarding } = require('../middleware/authMiddleware');
const fs = require('fs');
const path = require('path');
const scanModel = require('../models/scanModel');
const analysisModel = require('../models/analysisModel');
const skinAnalysisService = require('../services/skinAnalysisService');

// Apply middleware to all customer routes
router.use(requireAuth);
router.use(requireOnboarding);

router.get('/dashboard', (req, res) => {
    // Generate mock data if user has completed onboarding recently, but for the sake of MVP
    // let's say if the user has goals but hasn't "used" the app, it's empty.
    // For demonstration, we'll provide mock data if the user's name is "Mock User" or something.
    // To make it easy to see both states, we'll randomize or just provide the data if they have 'products' listed.
    
    let mockData = null;
    
    // Simple logic: if they entered products during onboarding, show populated state.
    // Otherwise, show empty state.
    if (req.session.user && req.session.user.profile_data && req.session.user.profile_data.products && req.session.user.profile_data.products.length > 0) {
        mockData = {
            latestScan: {
                date: 'Today, 08:00 AM',
                acneScore: 85,
                acneTrend: 'improving',
                rednessScore: 78,
                textureScore: 92,
                pigmentScore: 80
            },
            sunscreenCheck: {
                date: 'Today, 07:45 AM',
                score: 84,
                status: 'Cukup Merata',
                attentionAreas: 'Hidung dan pipi kanan'
            },
            progress: true
        };
    }

    res.render('customer/layout', { 
        page: 'dashboard', 
        title: 'Dashboard',
        mockData: mockData
    });
});

router.get('/scan', (req, res) => {
    res.render('customer/layout', { page: 'scan', title: 'Face Scan' });
});

router.post('/scan', (req, res) => {
    const { imageBase64, metadata } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ success: false, message: 'Image data missing' });
    }

    try {
        // Remove header from base64 string
        const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "");
        
        const timestamp = Date.now();
        const filename = `scan_${req.session.user.id}_${timestamp}.jpg`;
        const uploadPath = path.join(__dirname, '../../data/uploads', filename);

        // Save file securely outside public directory
        fs.writeFileSync(uploadPath, base64Data, 'base64');

        // Store metadata
        const scan = scanModel.createScan(req.session.user.id, filename, metadata || {});

        res.json({ success: true, scanId: scan.id, message: 'Scan saved successfully' });
    } catch (err) {
        console.error("Failed to save scan:", err);
        res.status(500).json({ success: false, message: 'Failed to process image' });
    }
});

router.get('/scan/image/:id', (req, res) => {
    const scanId = req.params.id;
    const scan = scanModel.getScanById(scanId);

    if (!scan) {
        return res.status(404).send('Image not found');
    }

    // Security check: only the owner can view
    if (scan.user_id !== req.session.user.id) {
        return res.status(403).send('Forbidden');
    }

    const imagePath = path.join(__dirname, '../../data/uploads', scan.image_path);
    if (fs.existsSync(imagePath)) {
        res.sendFile(imagePath);
    } else {
        res.status(404).send('Image file missing on disk');
    }
});

// Route to trigger analysis process
router.post('/scan/:id/analyze', async (req, res) => {
    const scanId = req.params.id;
    const scan = scanModel.getScanById(scanId);

    if (!scan || scan.user_id !== req.session.user.id) {
        return res.status(404).json({ success: false, message: 'Scan not found or access denied' });
    }

    try {
        // Update status to processing
        scanModel.updateScanStatus(scanId, 'processing');

        // Call the Mock AI Service
        const imagePath = path.join(__dirname, '../../data/uploads', scan.image_path);
        const results = await skinAnalysisService.analyzeSkin(scanId, imagePath);

        // Save analysis results
        analysisModel.createAnalysis(scanId, req.session.user.id, results);
        
        // Update scan status to completed
        scanModel.updateScanStatus(scanId, 'completed');

        res.json({ success: true, redirect: `/app/scan/result/${scanId}` });
    } catch (err) {
        console.error("Analysis failed:", err);
        scanModel.updateScanStatus(scanId, 'failed');
        res.status(500).json({ success: false, message: 'Analysis failed' });
    }
});

// Route to show analysis result
router.get('/scan/result/:id', (req, res) => {
    const scanId = req.params.id;
    const scan = scanModel.getScanById(scanId);

    if (!scan || scan.user_id !== req.session.user.id) {
        return res.status(404).render('error', { message: 'Scan not found' });
    }

    const analysis = analysisModel.getAnalysisByScanId(scanId);
    
    // If analysis is not ready yet, we can render a pending/processing state
    if (!analysis) {
        return res.render('customer/layout', { 
            page: 'result_pending', 
            title: 'Processing...',
            scan: scan
        });
    }

    // Get previous analysis for longitudinal tracking
    const previousAnalysis = analysisModel.getPreviousAnalysis(req.session.user.id, scanId);

    res.render('customer/layout', { 
        page: 'result', 
        title: 'Skin Analysis Result',
        scan: scan,
        analysis: analysis,
        previousAnalysis: previousAnalysis
    });
});

const sunscreenModel = require('../models/sunscreenModel');
const sunscreenAnalysisService = require('../services/sunscreenAnalysisService');

router.get('/sunscreen', (req, res) => {
    res.render('customer/layout', { page: 'sunscreen', title: 'Sunscreen Check' });
});

router.post('/sunscreen', (req, res) => {
    const { imageBase64, metadata } = req.body;
    if (!imageBase64) {
        return res.status(400).json({ success: false, message: 'Image data missing' });
    }

    try {
        const base64Data = imageBase64.replace(/^data:image\/jpeg;base64,/, "");
        const timestamp = Date.now();
        const filename = `sunscreen_${req.session.user.id}_${timestamp}.jpg`;
        const uploadPath = path.join(__dirname, '../../data/uploads', filename);

        fs.writeFileSync(uploadPath, base64Data, 'base64');
        const scan = scanModel.createScan(req.session.user.id, filename, metadata || {});

        res.json({ success: true, scanId: scan.id, message: 'Scan saved successfully' });
    } catch (err) {
        console.error("Failed to save scan:", err);
        res.status(500).json({ success: false, message: 'Failed to process image' });
    }
});

router.post('/sunscreen/:id/analyze', async (req, res) => {
    const scanId = req.params.id;
    const scan = scanModel.getScanById(scanId);

    if (!scan || scan.user_id !== req.session.user.id) {
        return res.status(404).json({ success: false, message: 'Scan not found or access denied' });
    }

    try {
        scanModel.updateScanStatus(scanId, 'processing');
        const imagePath = path.join(__dirname, '../../data/uploads', scan.image_path);
        const results = await sunscreenAnalysisService.analyzeSunscreen(scanId, imagePath);

        sunscreenModel.createScan(req.session.user.id, scanId, results);
        scanModel.updateScanStatus(scanId, 'completed');

        res.json({ success: true, redirect: `/app/sunscreen/result/${scanId}` });
    } catch (err) {
        console.error("Analysis failed:", err);
        scanModel.updateScanStatus(scanId, 'failed');
        res.status(500).json({ success: false, message: 'Analysis failed' });
    }
});

router.get('/sunscreen/result/:id', (req, res) => {
    const scanId = req.params.id;
    const scan = scanModel.getScanById(scanId);

    if (!scan || scan.user_id !== req.session.user.id) {
        return res.status(404).render('error', { message: 'Scan not found' });
    }

    const analysis = sunscreenModel.getScanByScanId(scanId);
    
    if (!analysis) {
        return res.render('customer/layout', { 
            page: 'result_pending', 
            title: 'Processing...',
            scan: scan
        });
    }

    res.render('customer/layout', { 
        page: 'sunscreen_result', 
        title: 'Sunscreen Check Result',
        scan: scan,
        analysis: analysis
    });
});

router.get('/history', (req, res) => {
    const userId = req.session.user.id;
    
    // Get all completed analyses for the user (sorted newest first)
    const analyses = analysisModel.getAnalysesByUserId(userId);
    
    // Map them to include scan data
    const historyData = analyses.map(analysis => {
        const scan = scanModel.getScanById(analysis.skin_scan_id);
        return {
            ...analysis,
            scan: scan
        };
    });

    // The baseline is the oldest valid scan
    const baseline = historyData.length > 0 ? historyData[historyData.length - 1] : null;

    res.render('customer/layout', { 
        page: 'history', 
        title: 'Skin Progress History',
        history: historyData,
        baseline: baseline
    });
});

router.delete('/scan/:id', (req, res) => {
    const scanId = req.params.id;
    const userId = req.session.user.id;
    
    // Delete the scan
    const scanDeleted = scanModel.deleteScanById(scanId, userId);
    
    if (scanDeleted) {
        // Delete associated analysis
        analysisModel.deleteAnalysisByScanId(scanId);
        res.json({ success: true, message: 'Scan deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Scan not found or unauthorized' });
    }
});

const aiController = require('../controllers/aiController');

router.get('/assistant', (req, res) => {
    res.render('customer/layout', { 
        page: 'assistant', 
        title: 'AI Assistant',
        contextType: req.query.contextType || null,
        contextId: req.query.contextId || null
    });
});

// AI API Routes
router.get('/api/chat/history', aiController.getChatHistory);
router.post('/api/chat/message', aiController.sendMessage);
router.post('/api/chat/clear', aiController.clearChatHistory);
router.delete('/api/chat/history', aiController.clearChatHistory);
router.delete('/api/chat/message/:id', aiController.deleteChatMessage);
router.post('/api/chatbot-widget', aiController.sendWidgetMessage);
router.post('/api/chatbot-widget/clear', aiController.clearChatHistory);

const productController = require('../controllers/productController');

// Product Catalog Routes
router.get('/products', productController.listProducts);
router.get('/products/:id', productController.getProductDetail);

const loginActivityModel = require('../models/loginActivityModel');
const userModel = require('../models/userModel');

router.get('/profile', (req, res) => {
    const userId = req.session.user.id;
    const loginHistory = loginActivityModel.getByUserId(userId, 15);
    res.render('customer/layout', { 
        page: 'profile', 
        title: 'Profile & Security',
        loginHistory
    });
});

router.get('/api/profile/login-history', (req, res) => {
    const userId = req.session.user.id;
    const loginHistory = loginActivityModel.getByUserId(userId, 20);
    res.json({ success: true, history: loginHistory });
});

router.delete('/api/profile', (req, res) => {
    const userId = req.session.user.id;
    try {
        // Hard delete all associated images to preserve privacy
        scanModel.hardDeleteScansByUserId(userId);
        
        // Clean up login history
        loginActivityModel.deleteByUserId(userId);

        // Soft delete the user record to keep aggregated metric integrity
        userModel.deleteUser(userId);
        
        // Destroy session
        req.session.destroy();
        res.json({ success: true, message: 'Account and data deleted successfully.' });
    } catch (err) {
        console.error('Failed to delete account:', err);
        res.status(500).json({ success: false, message: 'An error occurred during account deletion.' });
    }
});

module.exports = router;
