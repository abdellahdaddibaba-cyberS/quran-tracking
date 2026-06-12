const { Op, fn, col, literal } = require('sequelize');
const DailyTracking = require('../models/DailyTracking');
const Student = require('../models/Student');
const Halaqa = require('../models/Halaqa');
const { sequelize } = require('../config/db');

/**
 * جلب الطلاب الذين لديهم حفظ قليل (أقل من صفحتين) لمدة يومين أو ثلاثة متتالية
 */
const getLowPageStudents = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 2;
    const threshold = parseInt(req.query.threshold) || 2;

    // سنقوم بجلب آخر سجلات لكل طالب
    // نستخدم استعلام فرعي للحصول على آخر N سجلات لكل طالب
    const query = `
      WITH RankedTracking AS (
        SELECT 
          dt.*,
          s.name as "studentName",
          h.name as "halaqaName",
          ROW_NUMBER() OVER (PARTITION BY dt."studentId" ORDER BY dt."date" DESC) as rn
        FROM "daily_trackings" dt
        JOIN "students" s ON dt."studentId" = s."_id"
        JOIN "halaqat" h ON s."halaqaId" = h."_id"
        WHERE dt."attendance" = 'present'
      )
      SELECT * FROM RankedTracking WHERE rn <= :days
    `;

    const results = await sequelize.query(query, {
      replacements: { days },
      type: sequelize.QueryTypes.SELECT
    });

    // معالجة النتائج في JS للتحقق من الشرط المتتالي
    const studentGroups = {};
    results.forEach(row => {
      if (!studentGroups[row.studentId]) {
        studentGroups[row.studentId] = {
          id: row.studentId,
          name: row.studentName,
          halaqa: row.halaqaName,
          records: []
        };
      }
      studentGroups[row.studentId].records.push(row);
    });

    const lowPageStudents = Object.values(studentGroups)
      .filter(group => {
        // يجب أن يكون لديه عدد سجلات يساوي عدد الأيام المطلوبة
        if (group.records.length < days) return false;
        
        // يجب أن تكون جميع السجلات أقل من العتبة
        // ملاحظة: قد تعيد Postgres أسماء الأعمدة بحروف صغيرة إذا لم يتم اقتباسها، 
        // لكن Sequelize عادة ما يقتبسها ويحافظ على الحالة.
        return group.records.every(r => (r.pagesMemorized || r.pagesmemorized) < threshold);
      })
      .map(group => ({
        id: group.id,
        name: group.name,
        halaqa: group.halaqa,
        lastRecords: group.records.map(r => ({
          date: r.date,
          pages: r.pagesMemorized || r.pagesmemorized || 0
        }))
      }));

    res.json({
      success: true,
      count: lowPageStudents.length,
      data: lowPageStudents
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب الطلاب الذين لديهم جلسات فردية
 */
const getIndividualSessions = async (req, res) => {
  try {
    const records = await DailyTracking.findAll({
      where: {
        individualSession: true
      },
      include: [{
        model: Student,
        as: 'student',
        attributes: ['_id', 'name'],
        include: [{
          model: Halaqa,
          as: 'halaqa',
          attributes: ['name']
        }]
      }],
      order: [['date', 'DESC']]
    });

    // تجميع حسب الطالب لتجنب التكرار إذا كان لديه أكثر من جلسة
    const studentMap = {};
    records.forEach(rec => {
      const student = rec.student || rec.Student; // Sequelize include case
      if (!student) return;
      
      const studentId = student._id;
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          id: studentId,
          name: student.name,
          halaqa: student.halaqa ? student.halaqa.name : 'بدون حلقة',
          sessionCount: 0,
          lastSessionDate: rec.date,
          lastNote: rec.notes || ''
        };
      }
      studentMap[studentId].sessionCount++;
    });

    res.json({
      success: true,
      count: Object.keys(studentMap).length,
      data: Object.values(studentMap)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تسجيل أو إلغاء جلسة فردية لطالب في تاريخ معين
 */
const toggleSession = async (req, res) => {
  try {
    const { studentId, date, status, notes } = req.body;

    if (!studentId || !date) {
      return res.status(400).json({ success: false, message: 'معرف الطالب والتاريخ مطلوبان' });
    }

    // نحتاج لمعرفة القسط اليومي للطالب إذا كنا سننشئ سجلاً جديداً
    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // استخدام findOrCreate ثم التحديث لضمان عدم الكتابة فوق البيانات الأخرى (مثل الحفظ)
    const [record, created] = await DailyTracking.findOrCreate({
      where: { studentId, date },
      defaults: {
        pagesRequired: student.dailyTarget,
        pagesMemorized: 0,
        attendance: 'present',
        individualSession: status,
        notes: notes || ''
      }
    });

    if (!created) {
      if (status !== undefined) record.individualSession = status;
      if (notes !== undefined) record.notes = notes;
      await record.save();
    }

    res.json({
      success: true,
      message: 'تم تحديث بيانات الجلسة بنجاح',
      data: record
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStudentNotes = async (req, res) => {
  try {
    const { studentId } = req.params;

    const records = await DailyTracking.findAll({
      where: {
        studentId,
        [Op.or]: [
          { individualSession: true },
          { notes: { [Op.ne]: '' } }
        ]
      },
      order: [['date', 'DESC']]
    });

    res.json({
      success: true,
      data: records.map(r => ({
        date: r.date,
        notes: r.notes,
        individualSession: r.individualSession
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * حذف بيانات الجلسة (الملاحظات وعلامة الجلسة الفردية)
 */
const deleteSession = async (req, res) => {
  try {
    const { studentId, date } = req.body;

    const record = await DailyTracking.findOne({
      where: { studentId, date }
    });

    if (!record) {
      return res.status(404).json({ success: false, message: 'السجل غير موجود' });
    }

    // نصفر بيانات الجلسة فقط ونبقي على بيانات الحفظ الأخرى إن وجدت
    record.individualSession = false;
    record.notes = '';
    await record.save();

    res.json({
      success: true,
      message: 'تم حذف بيانات الجلسة بنجاح'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب الطلاب المستحقين للجائزة (أتموا قسطهم لمدة 3 أيام متتالية)
 */
const getAwardStudents = async (req, res) => {
  try {
    const days = 3; // افتراضياً 3 أيام

    const query = `
      SELECT 
        dt."_id", dt."studentId", dt."date", dt."pagesRequired", dt."pagesMemorized", dt."isSurahCompleted", dt."rewarded", dt."attendance",
        s."name" as "studentName", h."name" as "halaqaName"
      FROM "daily_trackings" dt
      JOIN "students" s ON dt."studentId" = s."_id"
      JOIN "halaqat" h ON s."halaqaId" = h."_id"
      WHERE (dt."rewarded" = false OR dt."rewarded" IS NULL)
      ORDER BY dt."studentId", dt."date" DESC
    `;

    const rawResults = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });

    const studentGroups = {};
    rawResults.forEach(row => {
      const sid = row.studentId || row.studentid || row._id;
      if (!sid) return;
      if (!studentGroups[sid]) {
        studentGroups[sid] = {
          id: sid,
          name: row.studentName || row.studentname || "طالب",
          halaqa: row.halaqaName || row.halaqaname || "حلقة",
          records: []
        };
      }
      studentGroups[sid].records.push(row);
    });

    const awardStudents = [];
    const potentialWinners = [];

    Object.values(studentGroups).forEach(group => {
      const records = group.records; // Ordered by date DESC
      let currentStreak = [];
      
      // We look for the MOST RECENT streak. 
      // Since records are DESC, we check from the most recent record backwards.
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const memorized = Number(r.pagesMemorized || r.pagesmemorized || 0);
        const required = Number(r.pagesRequired || r.pagesrequired || 0);
        const surahDone = r.isSurahCompleted || r.issurahcompleted || false;
        const attendance = r.attendance || r.attendance || 'present';
        
        const isSuccess = (attendance === 'present') && (memorized >= required || surahDone === true || surahDone === 1) && required > 0;

        if (isSuccess) {
          currentStreak.push(r);
          if (currentStreak.length >= 3) break; // Found a 3-day streak
        } else {
          // If this is the very first record (most recent) and it's a failure, streak is 0.
          // If we had some successes but then found a failure further back, the streak is broken.
          // Since we want 3 CONSECUTIVE days from the most recent, any failure/absence breaks it.
          if (currentStreak.length > 0) {
            // We had a streak starting from most recent, but it's broken now.
            break; 
          }
          // Otherwise, if we haven't found any successes yet, just keep looking for the "start" of a streak
          // (Actually, for awards, it usually means the LAST 3 days must be success)
        }
      }

      const studentInfo = {
        id: group.id,
        name: group.name,
        halaqa: group.halaqa,
        streakCount: currentStreak.length,
        lastRecords: currentStreak.map(r => ({
          id: r._id || r.id,
          date: r.date,
          pages: Number(r.pagesMemorized || r.pagesmemorized || 0),
          required: Number(r.pagesRequired || r.pagesrequired || 0),
          isSurahCompleted: !!(r.isSurahCompleted || r.issurahcompleted)
        }))
      };

      if (currentStreak.length >= 3) {
        awardStudents.push(studentInfo);
      } else if (currentStreak.length === 2) {
        potentialWinners.push(studentInfo);
      }
    });

    res.json({
      success: true,
      count: awardStudents.length,
      potentialCount: potentialWinners.length,
      data: awardStudents,
      potentialWinners: potentialWinners
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تسليم جائزة للطالب
 */
const givePrize = async (req, res) => {
  try {
    const { studentId, prizeTitle } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'معرف الطالب مطلوب' });
    }

    const Prize = require('../models/Prize');
    const Student = require('../models/Student');
    const User = require('../models/User');
    const { sendPushNotification } = require('../utils/notification');
    const { syncPushTokensFromSupabase } = require('../utils/syncPushTokens');

    // Determine icon and description based on prizeTitle
    let icon = 'star';
    let description = '';
    const titleText = prizeTitle || 'جائزة الانضباط';

    if (titleText.includes('تحسن')) {
      icon = 'trophy';
      description = 'مُنحت للطالب لتميزه وتحسن أدائه وحفظه خلال الأسبوع.';
    } else if (titleText.includes('انضباط') || titleText.includes('مواظبة')) {
      icon = 'medal';
      description = 'مُنحت للطالب لمواظبته وانضباطه المتميز في الحلقة.';
    } else if (titleText.includes('تفوق') || titleText.includes('تاج') || titleText.includes('بطل')) {
      icon = 'crown';
      description = 'مُنحت للطالب لتميزه الاستثنائي وتفوقه الكبير في الحفظ والمراجعة.';
    } else {
      icon = 'star';
      description = 'مُنحت للطالب تشجيعاً وتقديراً لجهوده الطيبة في الحلقة.';
    }

    const prize = await Prize.create({
      studentId,
      title: titleText,
      description,
      date: new Date(),
      icon
    });

    // Notify parent
    try {
      await syncPushTokensFromSupabase();
      const student = await Student.findByPk(studentId, {
        include: [{
          model: User,
          as: 'parent',
          attributes: ['_id', 'pushToken', 'fullName']
        }]
      });

      if (student && student.parent && student.parent.pushToken) {
        const title = `🏆 جائزة جديدة لـ ${student.name}`;
        const body = `يسرنا إبلاغكم بأن ابنكم ${student.name} حصل على "${titleText}". بارك الله فيه وزاده توفيقًا.`;
        
        await sendPushNotification([student.parent.pushToken], title, body, {
          studentId: String(student._id),
          type: 'prize',
          prizeId: String(prize.id)
        });
      }
    } catch (notifErr) {
      console.error('Failed to send prize notification:', notifErr);
    }

    res.json({ success: true, message: 'تم تسليم الجائزة بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب آخر الجوائز التي تم تسليمها
 */
const getRecentPrizes = async (req, res) => {
  try {
    const Prize = require('../models/Prize');
    const prizes = await Prize.findAll({
      include: [{
        model: Student,
        as: 'student',
        attributes: ['name'],
        include: [{
          model: Halaqa,
          as: 'halaqa',
          attributes: ['name']
        }]
      }],
      order: [['date', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      data: prizes
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getImprovementAwards = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'التاريخ مطلوب' });
    }

    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);

    // Current Week (Saturday to Thursday)
    const currentStartObj = new Date(dateObj);
    currentStartObj.setDate(dateObj.getDate() - 7);
    const currentEndObj = new Date(dateObj);
    currentEndObj.setDate(dateObj.getDate() - 2);

    // Previous Week (Saturday to Thursday of previous week)
    const prevStartObj = new Date(dateObj);
    prevStartObj.setDate(dateObj.getDate() - 14);
    const prevEndObj = new Date(dateObj);
    prevEndObj.setDate(dateObj.getDate() - 9);

    const toDateStr = (dObj) => {
      return `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
    };

    const currentStart = toDateStr(currentStartObj);
    const currentEnd = toDateStr(currentEndObj);
    const prevStart = toDateStr(prevStartObj);
    const prevEnd = toDateStr(prevEndObj);

    // Get all active students with dailyTarget <= 2
    const Student = require('../models/Student');
    const Halaqa = require('../models/Halaqa');
    const DailyTracking = require('../models/DailyTracking');

    const students = await Student.findAll({
      where: {
        isActive: true,
        dailyTarget: {
          [Op.lte]: 2
        }
      },
      include: [{
        model: Halaqa,
        as: 'halaqa',
        attributes: ['name']
      }]
    });

    const studentIds = students.map(s => s._id);

    // Fetch tracking data for both weeks
    const trackings = await DailyTracking.findAll({
      where: {
        studentId: {
          [Op.in]: studentIds
        },
        date: {
          [Op.between]: [prevStart, currentEnd]
        }
      }
    });

    // Process tracking data
    const trackingMap = {};
    trackings.forEach(t => {
      const sid = t.studentId;
      if (!trackingMap[sid]) {
        trackingMap[sid] = [];
      }
      trackingMap[sid].push(t);
    });

    const winners = [];

    students.forEach(student => {
      const studentTrackings = trackingMap[student._id] || [];
      
      let prevTotal = 0;
      let currentTotal = 0;

      studentTrackings.forEach(t => {
        const pages = Number(t.pagesMemorized || 0);
        const attendance = t.attendance || 'present';
        
        if (attendance === 'present') {
          if (t.date >= prevStart && t.date <= prevEnd) {
            prevTotal += pages;
          } else if (t.date >= currentStart && t.date <= currentEnd) {
            currentTotal += pages;
          }
        }
      });

      // الطالب الذي قسطه صفحتين أو أقل يترشح في حالتين:
      // 1. حقق 9 صفحات فما فوق هذا الأسبوع.
      // 2. أو حقق 14 صفحة هذا الأسبوع وكان قد حقق 9 صفحات في الأسبوع السابق (وهي مشمولة تلقائياً في الأولى، ولكن نحددها بـ isRaised لتمييز التحسن).
      if (currentTotal >= 9) {
        const isRaised = currentTotal >= 14 && prevTotal >= 9;
        winners.push({
          _id: student._id,
          name: student.name,
          halaqaName: student.halaqa?.name || '—',
          dailyTarget: student.dailyTarget,
          prevTotal,
          currentTotal,
          isRaised
        });
      }
    });

    res.json({
      success: true,
      data: {
        winners,
        ranges: {
          current: { start: currentStart, end: currentEnd },
          prev: { start: prevStart, end: prevEnd }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLowPageStudents,
  getIndividualSessions,
  toggleSession,
  getStudentNotes,
  deleteSession,
  getAwardStudents,
  givePrize,
  getRecentPrizes,
  getImprovementAwards
};
