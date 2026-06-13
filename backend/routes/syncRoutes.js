const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');

/**
 * POST /api/sync/run
 * يبدأ عملية المزامنة مع Supabase ويرجع النتيجة
 */
router.post('/run', protect, adminOnly, async (req, res) => {
  try {
    const { runSync } = require('../sync_to_supabase');
    await runSync();
    res.json({ success: true, message: 'تمت المزامنة مع Supabase بنجاح ✅' });
  } catch (err) {
    console.error('❌ فشلت المزامنة:', err.message);
    res.status(500).json({ success: false, message: err.message || 'فشلت المزامنة' });
  }
});

module.exports = router;
