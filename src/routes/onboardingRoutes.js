const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/:step', requireAuth, onboardingController.showStep);
router.post('/:step', requireAuth, onboardingController.processStep);

module.exports = router;
