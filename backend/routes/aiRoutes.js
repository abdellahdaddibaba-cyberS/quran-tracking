const express = require('express');
const router = express.Router();
const { getSuggestion, getHalaqaSuggestion } = require('../controllers/aiController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

// اقتراح القسط اليومي (LLM مع fallback إحصائي)
router.use(protect, staffOnly);
router.get('/suggest/halaqa/:halaqaId', getHalaqaSuggestion);
router.get('/suggest/:studentId', getSuggestion);

module.exports = router;
