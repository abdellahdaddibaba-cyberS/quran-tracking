const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  createStudent,
  createBulkStudents,
  updateStudent,
  deleteStudent,
} = require('../controllers/studentController');
const { protect, staffOnly } = require('../middleware/authMiddleware');

router.use(protect, staffOnly);

router.post('/bulk', createBulkStudents);
router.route('/').get(getStudents).post(createStudent);
router.route('/:id').get(getStudentById).put(updateStudent).delete(deleteStudent);

module.exports = router;
