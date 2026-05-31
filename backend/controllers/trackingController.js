const { Op } = require('sequelize');
const DailyTracking = require('../models/DailyTracking');
const Student = require('../models/Student');

// ─── إدخال يومي جماعي (Bulk Insert / Upsert) ──────────────────────────────
const bulkInsertTracking = async (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إرسال مصفوفة من السجلات' });
    }

    // معالجة السجلات لضمان التنسيق الصحيح
    const processedRecords = records.map((record) => {
      // Sequelize DATEONLY سيقوم بمعالجة التاريخ بشكل صحيح
      return { 
        studentId: record.studentId,
        date: record.date,
        pagesRequired: record.pagesRequired,
        pagesMemorized: record.pagesMemorized,
        notes: record.notes || '',
        attendance: record.attendance || 'present',
        isLate: record.isLate || false,
        individualSession: record.individualSession || false,
        isSurahCompleted: record.isSurahCompleted || false
      };
    });

    // في Postgres، يمكننا استخدام updateOnDuplicate أو upsert في حلقة
    // Sequelize bulkCreate مع updateOnDuplicate يتطلب تحديد الحقول التي سيتم تحديثها
    const result = await DailyTracking.bulkCreate(processedRecords, {
      updateOnDuplicate: ['pagesRequired', 'pagesMemorized', 'notes', 'attendance', 'isLate', 'individualSession', 'isSurahCompleted', 'updatedAt'],
    });

    // إرسال الإشعارات لأولياء الأمور
    try {
      const { sendPushNotification } = require('../utils/notification');
      const User = require('../models/User');
      
      const studentIds = processedRecords.map(r => r.studentId);
      const students = await Student.findAll({
        where: { _id: studentIds },
        include: [{
          model: User,
          as: 'parent',
          attributes: ['_id', 'pushToken']
        }]
      });

      const studentMap = {};
      students.forEach(s => {
        studentMap[s._id] = s;
      });

      for (const record of processedRecords) {
        const student = studentMap[record.studentId];
        if (student && student.parent && student.parent.pushToken) {
          let title = `متابعة التحصيل اليومي لـ ${student.name}`;
          let body = '';

          if (record.attendance === 'absent') {
            body = `تنبيه: تم تسجيل غياب ${student.name} اليوم عن الحلقة.`;
          } else if (record.attendance === 'excused') {
            body = `تنبيه: تم تسجيل غياب ${student.name} اليوم بعذر عن الحلقة.`;
          } else {
            if (record.isSurahCompleted) {
              body = `🎉 تهانينا! لقد تم تسجيل حضور ${student.name} وحفظ ${record.pagesMemorized} صفحات، وأكمل حفظ سورة اليوم! 🌟`;
            } else if (record.pagesMemorized > 0) {
              body = `تم تسجيل حضور ${student.name} وحفظه لـ ${record.pagesMemorized} صفحات بنجاح اليوم.`;
            } else {
              body = `تم تسجيل حضور ${student.name} في الحلقة اليوم.`;
            }
          }

          // إرسال الإشعار لولي الأمر
          sendPushNotification([student.parent.pushToken], title, body, {
            studentId: student._id,
            type: 'daily_tracking',
            date: record.date
          }).catch(err => console.error('Failed to send tracking push notification:', err));
        }
      }
    } catch (notifError) {
      console.error('Error triggering parent push notifications:', notifError);
    }

    res.status(201).json({
      success: true,
      message: `تم حفظ ${records.length} سجل بنجاح`,
      data: {
        count: result.length
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── جلب سجل طالب ─────────────────────────────────────────────────
const getStudentTracking = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { limit = 30, page = 1 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await DailyTracking.findAndCountAll({
      where: { studentId },
      include: [{
        model: Student,
        as: 'student',
        attributes: ['name', 'dailyTarget']
      }],
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    });

    res.json({
      success: true,
      count: rows.length,
      total: count,
      pages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      data: rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── جلب سجلات حلقة ليوم معين ────────────────────────────────────
const getHalaqaTracking = async (req, res) => {
  try {
    const { halaqaId } = req.params;
    const { date, startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (date) {
      where.date = date;
    }

    // Optimization: Single query using INNER JOIN instead of two separate operations
    const records = await DailyTracking.findAll({
      where,
      include: [{
        model: Student,
        as: 'student',
        attributes: ['name', 'dailyTarget'],
        where: { halaqaId, isActive: true } // Filter students directly in the join
      }],
      order: [['date', 'DESC']]
    });

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── مسح سجلات حلقة ليوم معين ────────────────────────────────────
const deleteHalaqaTrackingByDate = async (req, res) => {
  try {
    const { halaqaId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب للمسح' });
    }

    // Optimization: Use a subquery-like approach with literal if needed, 
    // or keep as-is if student set is small, but let's optimize with a single destroy if possible.
    // Sequelize destroy doesn't join well, but we can do a subquery in the 'where'
    const { sequelize } = require('../config/db');
    
    const deletedCount = await DailyTracking.destroy({
      where: {
        date: date,
        studentId: {
          [Op.in]: sequelize.literal(`(SELECT "_id" FROM "students" WHERE "halaqaId" = :hid)`)
        }
      },
      replacements: { hid: parseInt(halaqaId) }
    });

    res.json({ success: true, message: `تم مسح ${deletedCount} سجل بنجاح` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── جلب سجلات جميع الحلقات لفترة معينة (للتصدير) ────────────────
const getAllTrackingRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'يجب تحديد البداية والنهاية' });
    }

    const records = await DailyTracking.findAll({
      where: {
        date: { [Op.between]: [startDate, endDate] }
      },
      include: [{
        model: Student,
        as: 'student',
        attributes: ['name', 'dailyTarget', 'halaqaId']
      }]
    });

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  bulkInsertTracking, 
  getStudentTracking, 
  getHalaqaTracking, 
  deleteHalaqaTrackingByDate,
  getAllTrackingRange 
};
