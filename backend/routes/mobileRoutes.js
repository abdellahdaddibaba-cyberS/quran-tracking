const express = require('express');
const router = express.Router();
const { getMyStudents, getStudentTracking, getWeeklyReport } = require('../controllers/mobileController');
const { protect, parentOnly } = require('../middleware/authMiddleware');

router.use(protect, parentOnly);

router.get('/students', getMyStudents);
router.get('/weekly-report', getWeeklyReport);
router.get('/tracking/:studentId', getStudentTracking);

module.exports = router;
