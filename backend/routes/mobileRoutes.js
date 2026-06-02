const express = require('express');
const router = express.Router();
const { getMyStudents, getStudentTracking, getWeeklyReport, testPushNotification, submitFeedback } = require('../controllers/mobileController');
const { protect, parentOnly } = require('../middleware/authMiddleware');

router.use(protect, parentOnly);

router.get('/students', getMyStudents);
router.get('/weekly-report', getWeeklyReport);
router.get('/tracking/:studentId', getStudentTracking);
router.post('/test-push', testPushNotification);
router.post('/feedback', submitFeedback);

module.exports = router;
