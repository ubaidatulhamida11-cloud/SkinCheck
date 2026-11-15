const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/', (req, res) => {
    res.render('landing/index');
});

router.post('/api/chatbot-widget', aiController.sendWidgetMessage);
router.post('/api/chatbot-widget/clear', aiController.clearChatHistory);

module.exports = router;
