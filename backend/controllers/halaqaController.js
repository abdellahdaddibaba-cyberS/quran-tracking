const Halaqa = require('../models/Halaqa');
const Student = require('../models/Student');

// ─── جلب كل الحلقات ───────────────────────────────────────────────
const getHalaqat = async (req, res) => {
  try {
    const halaqat = await Halaqa.findAll({
      include: [{
        model: Student,
        as: 'students',
        attributes: []
      }],
      attributes: {
        include: [
          [Halaqa.sequelize.fn('COUNT', Halaqa.sequelize.col('students._id')), 'studentsCount']
        ]
      },
      group: ['Halaqa._id'],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, count: halaqat.length, data: halaqat });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── إنشاء حلقة جديدة ─────────────────────────────────────────────
const createHalaqa = async (req, res) => {
  try {
    const halaqa = await Halaqa.create(req.body);
    res.status(201).json({ success: true, data: halaqa });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── تعديل حلقة ───────────────────────────────────────────────────
const updateHalaqa = async (req, res) => {
  try {
    const halaqa = await Halaqa.findByPk(req.params.id);
    if (!halaqa) {
      return res.status(404).json({ success: false, message: 'الحلقة غير موجودة' });
    }
    await halaqa.update(req.body);
    res.json({ success: true, data: halaqa });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── حذف حلقة ─────────────────────────────────────────────────────
const deleteHalaqa = async (req, res) => {
  try {
    const halaqa = await Halaqa.findByPk(req.params.id);
    if (!halaqa) {
      return res.status(404).json({ success: false, message: 'الحلقة غير موجودة' });
    }
    await halaqa.destroy();
    res.json({ success: true, message: 'تم حذف الحلقة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getHalaqat, createHalaqa, updateHalaqa, deleteHalaqa };
