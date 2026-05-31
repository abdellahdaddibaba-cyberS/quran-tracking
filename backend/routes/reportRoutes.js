const express = require('express');
const router = express.Router();
const {
  getLowPageStudents,
  getIndividualSessions,
  toggleSession,
  getStudentNotes,
  deleteSession,
  getAwardStudents,
  givePrize,
  getRecentPrizes
} = require('../controllers/reportController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.use(protect, staffOnly);

router.get('/low-pages', getLowPageStudents);
router.get('/individual-sessions', getIndividualSessions);
router.post('/toggle-session', toggleSession);
router.get('/student-notes/:studentId', getStudentNotes);
router.post('/delete-session', deleteSession);
router.get('/award-students', getAwardStudents);
router.get('/recent-prizes', getRecentPrizes);
router.post('/give-prize', givePrize);

module.exports = router;
