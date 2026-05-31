const { Op } = require('sequelize');
const Student = require('../models/Student');
const DailyTracking = require('../models/DailyTracking');
const Halaqa = require('../models/Halaqa');

/**
 * جلب أبناء ولي الأمر المسجل دخوله حالياً
 */
const getMyStudents = async (req, res) => {
  try {
    const students = await Student.findAll({
      where: { parentId: req.user._id },
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name', 'supervisor']
      }]
    });

    res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب سجل التحصيل اليومي لطالب معين (يجب أن يكون ابناً لولي الأمر)
 */
const getStudentTracking = async (req, res) => {
  try {
    const { studentId } = req.params;

    // التأكد من أن الطالب يخص ولي الأمر
    const student = await Student.findOne({
      where: { _id: studentId, parentId: req.user._id }
    });

    if (!student) {
      return res.status(403).json({ success: false, message: 'غير مسموح لك بالوصول لبيانات هذا الطالب' });
    }

    const tracking = await DailyTracking.findAll({
      where: { studentId },
      order: [['date', 'DESC']],
      limit: 30 // آخر شهر
    });

    const prizes = await require('../models/Prize').findAll({
      where: { studentId },
      order: [['date', 'DESC']]
    });

    res.json({ success: true, data: { student, tracking, prizes } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تقرير أسبوعي لأبناء ولي الأمر (للويب والموبايل)
 */
const getWeeklyReport = async (req, res) => {
  try {
    const { startDate, endDate, halaqaId } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'معاملات startDate و endDate مطلوبة',
      });
    }

    const studentWhere = { parentId: req.user._id };
    if (halaqaId) studentWhere.halaqaId = halaqaId;

    const students = await Student.findAll({
      where: studentWhere,
      include: [{ model: Halaqa, as: 'halaqa', attributes: ['_id', 'name', 'supervisor'] }],
    });

    if (students.length === 0) {
      return res.json({ success: true, data: { halaqat: [], students: [], tracking: [] } });
    }

    const studentIds = students.map((s) => s._id);
    const tracking = await DailyTracking.findAll({
      where: {
        studentId: { [Op.in]: studentIds },
        date: { [Op.between]: [startDate, endDate] },
      },
    });

    const halaqaMap = new Map();
    students.forEach((s) => {
      if (s.halaqa) halaqaMap.set(s.halaqa._id, s.halaqa);
    });

    res.json({
      success: true,
      data: {
        halaqat: Array.from(halaqaMap.values()),
        students,
        tracking,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyStudents, getStudentTracking, getWeeklyReport };
