const express = require('express');
const router = express.Router();
const { getSuggestion } = require('../controllers/aiController');

// الاقتراح الذكي لطالب
router.get('/suggest/:studentId', getSuggestion);

module.exports = router;
