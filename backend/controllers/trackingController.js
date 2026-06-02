const { Op } = require('sequelize');
const DailyTracking = require('../models/DailyTracking');
const Student = require('../models/Student');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notification');
const { syncPushTokensFromSupabase } = require('../utils/syncPushTokens');

function normalizeDateOnly(date) {
  if (!date) return '';
  if (typeof date === 'string') return date.slice(0, 10);
  if (date instanceof Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(date).slice(0, 10);
}

function trackingRecordKey(studentId, date) {
  return `${Number(studentId)}-${normalizeDateOnly(date)}`;
}

/** حقول تؤثر على نص الإشعار — إذا لم تتغير لا نُعيد الإرسال */
function trackingDataChanged(existing, incoming) {
  return (
    Number(existing.pagesMemorized) !== Number(incoming.pagesMemorized) ||
    (existing.attendance || 'present') !== (incoming.attendance || 'present') ||
    Boolean(existing.isLate) !== Boolean(incoming.isLate) ||
    Boolean(existing.isSurahCompleted) !== Boolean(incoming.isSurahCompleted) ||
    String(existing.notes || '') !== String(incoming.notes || '')
  );
}

/**
 * الإدخال اليومي يحفظ كل أسبوع دفعة واحدة — نُرسل إشعاراً فقط للسجلات الجديدة أو المعدّلة.
 */
async function filterRecordsNeedingNotification(processedRecords) {
  if (!processedRecords.length) return [];

  const existingRows = await DailyTracking.findAll({
    where: {
      [Op.or]: processedRecords.map((r) => ({
        studentId: r.studentId,
        date: normalizeDateOnly(r.date),
      })),
    },
  });

  const existingByKey = new Map(
    existingRows.map((row) => [trackingRecordKey(row.studentId, row.date), row])
  );

  return processedRecords.filter((incoming) => {
    const existing = existingByKey.get(trackingRecordKey(incoming.studentId, incoming.date));
    if (!existing) return true;
    return trackingDataChanged(existing, incoming);
  });
}

async function sendParentNotificationsForRecords(processedRecords) {
  const summary = {
    sent: 0,
    skipped: [],
    errors: [],
  };

  await syncPushTokensFromSupabase();

  const studentIds = [...new Set(processedRecords.map((r) => Number(r.studentId)).filter(Boolean))];
  if (studentIds.length === 0) return summary;

  const students = await Student.findAll({
    where: { _id: { [Op.in]: studentIds } },
    include: [{
      model: User,
      as: 'parent',
      attributes: ['_id', 'pushToken', 'fullName'],
    }],
  });

  const studentMap = new Map(students.map((s) => [Number(s._id), s]));

  for (const record of processedRecords) {
    const student = studentMap.get(Number(record.studentId));
    if (!student) {
      summary.skipped.push({ studentId: record.studentId, reason: 'student_not_found' });
      continue;
    }
    if (!student.parent) {
      summary.skipped.push({ student: student.name, reason: 'no_parent_linked' });
      continue;
    }
    if (!student.parent.pushToken) {
      summary.skipped.push({
        student: student.name,
        parent: student.parent.fullName,
        reason: 'no_push_token',
      });
      continue;
    }

    let title = `متابعة التحصيل اليومي لـ ${student.name}`;
    let body = '';

    if (record.attendance === 'absent') {
      body = `نحيطكم علمًا بتغيب ابنكم ${student.name} اليوم.`;
    } else if (record.attendance === 'excused') {
      body = `نحيطكم علمًا بتغيب ابنكم ${student.name} اليوم بعذر.`;
    } else if (record.isSurahCompleted) {
      body = `🎉 يسرنا إبلاغكم بأن ابنكم ${student.name} أتمَّ اليوم حفظ سورة كاملة، وحفظ ${record.pagesMemorized} صفحات. بارك الله فيه وزاده توفيقًا.`;
    } else if (record.pagesMemorized > 0) {
      body = `يسرنا إبلاغكم بأن ابنكم ${student.name} حفظ اليوم ${record.pagesMemorized} صفحات. نسأل الله له المزيد من التقدم والنجاح.`;
    } else {
      body = `يسرنا إبلاغكم بحضور ابنكم ${student.name} اليوم.`;
    }

    const result = await sendPushNotification([student.parent.pushToken], title, body, {
      studentId: student._id,
      type: 'daily_tracking',
      date: record.date,
    });

    summary.sent += result.sent;
    if (result.errors?.length) summary.errors.push(...result.errors);
    if (result.receiptErrors?.length) summary.errors.push(...result.receiptErrors.map((e) => e.message));
  }

  return summary;
}

// ─── إدخال يومي جماعي (Bulk Insert / Upsert) ──────────────────────────────
const bulkInsertTracking = async (req, res) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'يجب إرسال مصفوفة من السجلات' });
    }

    const processedRecords = records.map((record) => ({
      studentId: record.studentId,
      date: record.date,
      pagesRequired: record.pagesRequired,
      pagesMemorized: record.pagesMemorized,
      notes: record.notes || '',
      attendance: record.attendance || 'present',
      isLate: record.isLate || false,
      individualSession: record.individualSession || false,
      isSurahCompleted: record.isSurahCompleted || false,
    }));

    const recordsToNotify = await filterRecordsNeedingNotification(processedRecords);

    const result = await DailyTracking.bulkCreate(processedRecords, {
      updateOnDuplicate: ['pagesRequired', 'pagesMemorized', 'notes', 'attendance', 'isLate', 'individualSession', 'isSurahCompleted', 'updatedAt'],
    });

    let notifications = { sent: 0, skipped: [], errors: [], unchanged: processedRecords.length - recordsToNotify.length };
    try {
      notifications = await sendParentNotificationsForRecords(recordsToNotify);
      notifications.unchanged = processedRecords.length - recordsToNotify.length;
      if (notifications.unchanged > 0) {
        console.log(`ℹ️ تخطي ${notifications.unchanged} إشعار — السجلات لم تتغير`);
      }
      if (notifications.sent > 0) {
        console.log(`📲 تم إرسال ${notifications.sent} إشعار بعد حفظ التحصيل`);
      }
      if (notifications.skipped.length > 0) {
        console.warn('⚠️ إشعارات لم تُرسل:', JSON.stringify(notifications.skipped));
      }
    } catch (notifError) {
      console.error('Error triggering parent push notifications:', notifError);
      notifications.errors.push(notifError.message);
    }

    res.status(201).json({
      success: true,
      message: `تم حفظ ${records.length} سجل بنجاح`,
      data: {
        count: result.length,
        notifications,
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

    const records = await DailyTracking.findAll({
      where,
      include: [{
        model: Student,
        as: 'student',
        attributes: ['name', 'dailyTarget'],
        where: { halaqaId, isActive: true }
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
  getAllTrackingRange,
};
