const { Op } = require('sequelize');
const Student = require('../models/Student');
const Halaqa = require('../models/Halaqa');
const DailyTracking = require('../models/DailyTracking');
const Prize = require('../models/Prize');
const SwimmingSchedule = require('../models/SwimmingSchedule');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const { sendPushNotification } = require('../utils/notification');
const { syncPushTokensFromSupabase } = require('../utils/syncPushTokens');

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
  const transaction = await sequelize.transaction();
  try {
    const student = await Student.findByPk(req.params.id, { transaction });
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // Delete dependent daily trackings
    await DailyTracking.destroy({
      where: { studentId: req.params.id },
      transaction
    });

    // Delete dependent prizes
    await Prize.destroy({
      where: { studentId: req.params.id },
      transaction
    });

    // Delete the student
    await student.destroy({ transaction });

    await transaction.commit();
    res.json({ success: true, message: 'تم حذف الطالب بنجاح' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── إرسال إشعارات السباحة لأولياء الأمور ────────────────────────────
const sendSwimmingNotifications = async (studentIds, date) => {
  try {
    await syncPushTokensFromSupabase();
    const students = await Student.findAll({
      where: { _id: { [Op.in]: studentIds } },
      include: [{
        model: User,
        as: 'parent',
        attributes: ['_id', 'pushToken', 'fullName']
      }]
    });

    for (const student of students) {
      if (student.parent && student.parent.pushToken) {
        const formattedDate = new Date(date).toLocaleDateString('ar-DZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
        const title = `🏊‍♂️ يوم السباحة لـ ${student.name}`;
        const body = `نحيطكم علمًا بأن ابنكم ${student.name} معني بالسباحة ليوم ${formattedDate}. يرجى تحضير لوازم السباحة الخاصة به.`;

        await sendPushNotification([student.parent.pushToken], title, body, {
          studentId: student._id,
          type: 'swimming_schedule',
          date: date
        });
      }
    }
  } catch (error) {
    console.error('Failed to send swimming notifications:', error);
  }
};

// ─── جلب جدول السباحة لتاريخ معين ────────────────────────────────────
const getSwimmingSchedule = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    }

    const schedules = await SwimmingSchedule.findAll({
      where: { date },
      attributes: ['studentId']
    });

    const studentIds = schedules.map(s => s.studentId);
    res.json({ success: true, data: studentIds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── جلب جدول السباحة الأسبوعي ────────────────────────────────────────
const getWeeklySwimmingSchedule = async (req, res) => {
  try {
    const { weekStart } = req.query; // YYYY-MM-DD (أول يوم في الأسبوع)
    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'تاريخ بداية الأسبوع مطلوب' });
    }

    // توليد 7 تواريخ ابتداءً من weekStart
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const schedules = await SwimmingSchedule.findAll({
      where: { date: { [Op.in]: dates } },
      include: [{
        model: Student,
        as: 'student',
        attributes: ['_id', 'name', 'halaqaId']
      }],
      order: [['date', 'ASC']]
    });

    // تجميع حسب التاريخ
    const grouped = {};
    for (const date of dates) {
      grouped[date] = [];
    }
    for (const s of schedules) {
      if (grouped[s.date] !== undefined) {
        grouped[s.date].push(s.student);
      }
    }

    res.json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// ─── حفظ جدول السباحة لتاريخ معين ────────────────────────────────────
const saveSwimmingSchedule = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { date, studentIds } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    }
    if (!studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ success: false, message: 'مصفوفة الطلاب غير صالحة' });
    }

    // 1. جلب الطلاب المسجلين سابقاً لمعرفة من تمت إضافته حديثاً لإرسال إشعار له
    const oldSchedules = await SwimmingSchedule.findAll({
      where: { date },
      attributes: ['studentId'],
      transaction
    });
    const oldStudentIds = new Set(oldSchedules.map(s => Number(s.studentId)));

    // 2. حذف السجلات القديمة للتاريخ المحدد
    await SwimmingSchedule.destroy({
      where: { date },
      transaction
    });

    // 3. إدخال السجلات الجديدة
    if (studentIds.length > 0) {
      const records = studentIds.map(sid => ({
        studentId: Number(sid),
        date
      }));
      await SwimmingSchedule.bulkCreate(records, { transaction });
    }

    await transaction.commit();

    // 4. إرسال إشعارات للآباء المضافين حديثاً
    const newlyAddedIds = studentIds
      .map(id => Number(id))
      .filter(id => !oldStudentIds.has(id));

    if (newlyAddedIds.length > 0) {
      sendSwimmingNotifications(newlyAddedIds, date).catch(err => {
        console.error('Error in sendSwimmingNotifications async background execution:', err);
      });
    }

    res.json({ success: true, message: 'تم حفظ جدول السباحة بنجاح وإرسال الإشعارات للآباء المعنيين' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  createStudent,
  createBulkStudents,
  updateStudent,
  deleteStudent,
  getSwimmingSchedule,
  getWeeklySwimmingSchedule,
  saveSwimmingSchedule
};
