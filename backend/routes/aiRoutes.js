const express = require('express');
const router = express.Router();
const { getSuggestion } = require('../controllers/aiController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

// اقتراح القسط اليومي (قواعد إحصائية على آخر 7 أيام — ليس نموذج LLM)
router.use(protect, staffOnly);
router.get('/suggest/:studentId', getSuggestion);

module.exports = router;
