const express = require('express');
const router = express.Router();
const {
  bulkInsertTracking,
  getStudentTracking,
  getHalaqaTracking,
  deleteHalaqaTrackingByDate,
  getAllTrackingRange,
  getHalaqaCumulativeTotals,
} = require('../controllers/trackingController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.use(protect, staffOnly);

// إدخال جماعي
router.post('/bulk', bulkInsertTracking);
router.get('/all',  getAllTrackingRange);

// سجل طالب
router.get('/:studentId', getStudentTracking);

// سجلات حلقة ليوم معين
router.get('/halaqa/:halaqaId', getHalaqaTracking);
router.delete('/halaqa/:halaqaId', deleteHalaqaTrackingByDate);

// الإجمالي التراكمي لكل طالب في حلقة
router.get('/halaqa/:halaqaId/cumulative', getHalaqaCumulativeTotals);

module.exports = router;
