const express = require('express');
const router = express.Router();
const { getMyStudents, getStudentTracking } = require('../controllers/mobileController');
const { protect } = require('../middleware/authMiddleware');

// جميع مسارات الموبايل تتطلب تسجيل الدخول
router.use(protect);

router.get('/students', getMyStudents);
router.get('/tracking/:studentId', getStudentTracking);

module.exports = router;
