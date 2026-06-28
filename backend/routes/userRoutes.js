const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getFeedbacks, likeFeedback, getParentAccessReport } = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// جميع مسارات المستخدمين تتطلب صلاحيات الأدمن
router.use(protect);
router.use(adminOnly);

router.get('/', getUsers);
router.get('/feedback', getFeedbacks);
router.post('/feedback/:id/like', likeFeedback);
router.get('/parent-access-report', getParentAccessReport);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
