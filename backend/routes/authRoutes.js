const express = require('express');
const router = express.Router();
const { login, getLoginLogs, getMe, updateProfile } = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/logs', protect, adminOnly, getLoginLogs);
router.put('/profile', protect, updateProfile);

module.exports = router;
