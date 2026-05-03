const express = require('express');
const router = express.Router();
const { getHalaqat, createHalaqa, updateHalaqa, deleteHalaqa } = require('../controllers/halaqaController');

router.route('/').get(getHalaqat).post(createHalaqa);
router.route('/:id').put(updateHalaqa).delete(deleteHalaqa);

module.exports = router;
