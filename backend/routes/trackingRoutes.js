const express = require('express');
const router = express.Router();
const {
  bulkInsertTracking,
  getStudentTracking,
  getHalaqaTracking,
  deleteHalaqaTrackingByDate,
  getAllTrackingRange,
} = require('../controllers/trackingController');

// إدخال جماعي
router.post('/bulk', bulkInsertTracking);
router.get('/all',  getAllTrackingRange);

// سجل طالب
router.get('/:studentId', getStudentTracking);

// سجلات حلقة ليوم معين
router.get('/halaqa/:halaqaId', getHalaqaTracking);
router.delete('/halaqa/:halaqaId', deleteHalaqaTrackingByDate);

module.exports = router;
