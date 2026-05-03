const Student = require('../models/Student');
const Halaqa = require('../models/Halaqa');

// ─── جلب الطلبة (كل الطلبة أو حسب الحلقة) ───────────────────────
const getStudents = async (req, res) => {
  try {
    const where = {};
    if (req.query.halaqaId) {
      where.halaqaId = req.query.halaqaId;
    }
    if (req.query.isActive !== undefined) {
      where.isActive = req.query.isActive === 'true';
    }

    const students = await Student.findAll({
      where,
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name', 'supervisor']
      }],
      order: [['name', 'ASC']]
    });

    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── جلب طالب واحد ────────────────────────────────────────────────
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id, {
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name', 'supervisor']
      }]
    });
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── إضافة طالب ───────────────────────────────────────────────────
const createStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    const populated = await Student.findByPk(student._id, {
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name', 'supervisor']
      }]
    });
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── إضافة طلبة بشكل جماعي ───────────────────────────────────────────
const createBulkStudents = async (req, res) => {
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'قائمة الطلبة غير صالحة أو فارغة' });
    }
    const inserted = await Student.bulkCreate(students);
    res.status(201).json({ success: true, count: inserted.length, data: inserted });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── تعديل طالب ───────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }
    
    await student.update(req.body);
    
    const updated = await Student.findByPk(student._id, {
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name', 'supervisor']
      }]
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ─── حذف طالب ─────────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }
    await student.destroy();
    res.json({ success: true, message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStudents, getStudentById, createStudent, createBulkStudents, updateStudent, deleteStudent };
