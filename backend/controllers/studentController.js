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
  const transaction = await sequelize.transaction();
  try {
    const { students } = req.body;
    if (!students || !Array.isArray(students) || students.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'قائمة الطلبة غير صالحة أو فارغة' });
    }

    // جلب جميع أولياء الأمور الحاليين لتجنب تكرار الاستعلامات وتجنب إنشاء تكرارات
    const existingParents = await User.findAll({
      where: { role: 'parent' },
      transaction
    });

    const normalizeArabic = (text) => {
      if (!text) return '';
      return String(text)
        .trim()
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, '')
        .toLowerCase();
    };

    const parentCache = [...existingParents];
    let parentsCreatedCount = 0;

    const processedStudents = [];

    for (const studentData of students) {
      const student = { ...studentData };
      let parentId = student.parentId;

      // إذا لم يكن لدى الطالب parentId ولكن لديه اسم ولي أمر، نحاول ربطه أو إنشائه
      if (!parentId && student.parentName && String(student.parentName).trim()) {
        const pName = String(student.parentName).trim();
        const pPhone = student.parentPhone ? String(student.parentPhone).trim() : '';

        // 1. البحث في الكاش المحلي (الذي يضم أولياء الأمور الحاليين والجدد المنشئين في هذه الدفعة)
        let matchedParent = null;
        if (pPhone) {
          matchedParent = parentCache.find(p => p.phoneNumber && String(p.phoneNumber).trim() === pPhone);
        }
        if (!matchedParent) {
          const normPName = normalizeArabic(pName);
          matchedParent = parentCache.find(p => p.fullName && normalizeArabic(p.fullName) === normPName);
        }

        if (matchedParent) {
          parentId = matchedParent._id;
        } else {
          // 2. إذا لم نعثر عليه، نقوم بإنشاء ولي أمر جديد
          // توليد اسم مستخدم فريد
          let username = '';
          if (pPhone) {
            const cleanPhone = pPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 6) {
              const isTaken = parentCache.some(p => p.username === cleanPhone) ||
                              await User.findOne({ where: { username: cleanPhone }, transaction });
              if (!isTaken) {
                username = cleanPhone;
              }
            }
          }

          if (!username) {
            let isUnique = false;
            while (!isUnique) {
              const rand = Math.floor(100000 + Math.random() * 900000);
              username = `parent_${rand}`;
              const isTaken = parentCache.some(p => p.username === username) ||
                              await User.findOne({ where: { username }, transaction });
              if (!isTaken) {
                isUnique = true;
              }
            }
          }

          const newParent = await User.create({
            username,
            password: '123456', // كلمة المرور الافتراضية
            fullName: pName,
            role: 'parent',
            phoneNumber: pPhone || null,
            isActive: true
          }, { transaction });

          parentCache.push(newParent);
          parentId = newParent._id;
          parentsCreatedCount++;
        }
      }

      student.parentId = parentId;
      processedStudents.push(student);
    }

    const inserted = await Student.bulkCreate(processedStudents, { transaction });
    await transaction.commit();

    res.status(201).json({
      success: true,
      count: inserted.length,
      parentsCreated: parentsCreatedCount,
      data: inserted
    });
  } catch (error) {
    await transaction.rollback();
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

    // Delete dependent swimming schedules
    await SwimmingSchedule.destroy({
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
    const { date, auto } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    }

    const schedules = await SwimmingSchedule.findAll({
      where: { date },
      attributes: ['studentId']
    });

    // إذا كانت هناك سجلات محفوظة مسبقاً ولم يطلب المستخدم صراحة إعادة التوليد التلقائي (auto=true)
    if (schedules.length > 0 && auto !== 'true') {
      const studentIds = schedules.map(s => s.studentId);
      return res.json({ success: true, data: studentIds });
    }

    // التحقق مما إذا كان اليوم هو السبت وبدءاً من الأسبوع الثاني (27 جوان 2026 فما فوق)
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const isSaturday = dateObj.getDay() === 6;
    const isFromWeekTwo = date >= '2026-06-27';

    // إذا لم يكن هناك سجلات محفوظة مسبقاً (أو تم طلب auto=true) وكان التاريخ هو سبت بدءاً من الأسبوع الثاني، نقوم بالتوليد التلقائي
    if ((schedules.length === 0 || auto === 'true') && isSaturday && isFromWeekTwo) {
      // حساب نطاق الأسبوع (السبت السابق إلى الخميس الحالي)
      const prevSatDate = new Date(dateObj);
      prevSatDate.setDate(dateObj.getDate() - 7);
      const thuDate = new Date(dateObj);
      thuDate.setDate(dateObj.getDate() - 2);

      const toDateStr = (dObj) => {
        return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
      };

      const startRangeStr = toDateStr(prevSatDate);
      const endRangeStr = toDateStr(thuDate);

      // جلب جميع الطلبة النشطين
      const students = await Student.findAll({ where: { isActive: true } });

      // جلب سجلات المتابعة خلال الأسبوع المحدد
      const trackings = await DailyTracking.findAll({
        where: {
          date: {
            [Op.between]: [startRangeStr, endRangeStr]
          }
        }
      });

      // تجميع السجلات حسب الطالب
      const trackingMap = new Map();
      trackings.forEach(t => {
        if (!trackingMap.has(t.studentId)) {
          trackingMap.set(t.studentId, []);
        }
        trackingMap.get(t.studentId).push(t);
      });

      const autoStudentIds = [];

      for (const student of students) {
        const studentTrackings = trackingMap.get(student._id) || [];
        
        let memorizedSum = 0;
        let surahCompletions = 0;

        studentTrackings.forEach(t => {
          if (t.attendance === 'present') {
            memorizedSum += Number(t.pagesMemorized || 0);
            if (t.isSurahCompleted) {
              surahCompletions++;
            }
          }
        });

        const targetScore = Number(student.dailyTarget || 1) * 6;
        const achievementScore = memorizedSum + (surahCompletions * 0.5 * Number(student.dailyTarget || 1));

        if (achievementScore >= targetScore) {
          autoStudentIds.push(student._id);
        }
      }

      return res.json({ success: true, data: autoStudentIds, autoGenerated: true });
    }

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
