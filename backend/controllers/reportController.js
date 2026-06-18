const { Op, fn, col, literal } = require('sequelize');
const DailyTracking = require('../models/DailyTracking');
const Student = require('../models/Student');
const Halaqa = require('../models/Halaqa');
const Prize = require('../models/Prize');
const User = require('../models/User');
const { sequelize } = require('../config/db');
const { sendPushNotification } = require('../utils/notification');
const { syncPushTokensFromSupabase } = require('../utils/syncPushTokens');
const { runSync } = require('../sync_to_supabase');

/**
 * دالة مساعدة لتوحيد أسماء الأعمدة المسترجعة من PostgreSQL (Raw Queries)
 */
function getColumn(row, camelName) {
  if (row[camelName] !== undefined) return row[camelName];
  return row[camelName.toLowerCase()];
}

/**
 * جلب الطلاب الذين لديهم حفظ قليل (أقل من صفحتين) لمدة يومين أو ثلاثة متتالية
 */
const getLowPageStudents = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 2;
    const threshold = parseInt(req.query.threshold) || 2;

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

    const studentGroups = {};
    results.forEach(row => {
      const studentId = getColumn(row, 'studentId');
      const studentName = getColumn(row, 'studentName');
      const halaqaName = getColumn(row, 'halaqaName');
      const pagesMemorized = Number(getColumn(row, 'pagesMemorized') || 0);

      if (!studentGroups[studentId]) {
        studentGroups[studentId] = {
          id: studentId,
          name: studentName,
          halaqa: halaqaName,
          records: []
        };
      }
      studentGroups[studentId].records.push({ ...row, pagesMemorized });
    });

    const lowPageStudents = Object.values(studentGroups)
      .filter(group => {
        if (group.records.length < days) return false;
        return group.records.every(r => r.pagesMemorized < threshold);
      })
      .map(group => ({
        id: group.id,
        name: group.name,
        halaqa: group.halaqa,
        lastRecords: group.records.map(r => ({
          date: r.date,
          pages: r.pagesMemorized || 0
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

    const studentMap = {};
    records.forEach(rec => {
      const student = rec.student || rec.Student;
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

    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

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
    const query = `
      SELECT 
        dt."_id", dt."studentId", dt."date", dt."pagesRequired", dt."pagesMemorized", 
        dt."isSurahCompleted", dt."rewarded", dt."attendance",
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
      const sid = getColumn(row, 'studentId') || row._id;
      if (!sid) return;
      if (!studentGroups[sid]) {
        studentGroups[sid] = {
          id: sid,
          name: getColumn(row, 'studentName') || "طالب",
          halaqa: getColumn(row, 'halaqaName') || "حلقة",
          records: []
        };
      }
      studentGroups[sid].records.push(row);
    });

    const awardStudents = [];
    const potentialWinners = [];

    Object.values(studentGroups).forEach(group => {
      const records = group.records;
      let currentStreak = [];
      
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const memorized = Number(getColumn(r, 'pagesMemorized') || 0);
        const required = Number(getColumn(r, 'pagesRequired') || 0);
        const surahDone = getColumn(r, 'isSurahCompleted') || false;
        const attendance = getColumn(r, 'attendance') || 'present';
        
        const isSuccess = (attendance === 'present') && (memorized >= required || surahDone === true || surahDone === 1) && required > 0;

        if (isSuccess) {
          currentStreak.push(r);
          if (currentStreak.length >= 3) break;
        } else {
          if (currentStreak.length > 0) break;
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
          pages: Number(getColumn(r, 'pagesMemorized') || 0),
          required: Number(getColumn(r, 'pagesRequired') || 0),
          isSurahCompleted: !!getColumn(r, 'isSurahCompleted')
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

    let icon = 'star';
    let description = '';
    const titleText = prizeTitle || 'جائزة الانضباط';

    if (titleText.includes('الأداء في السورة') || titleText.includes('الاداء في السورة')) {
      icon = 'crown';
      description = 'مُنحت للطالب لاستظهاره سورتين بحفظ ممتاز من الوهلة الأولى.';
    } else if (titleText.includes('تحسن')) {
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

    runSync().catch(err => {
      console.error('⚠️ [Sync on Prize Give] Failed to sync to Supabase:', err.message);
    });

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
    const inputObj = new Date(y, m - 1, d);

    const toDateStr = (dObj) =>
      `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;

    const dayOfWeek = inputObj.getDay();
    const diffToThursday = (4 - dayOfWeek + 7) % 7;
    const thursday = new Date(inputObj);
    thursday.setDate(inputObj.getDate() + diffToThursday);

    const currentSat = new Date(thursday);
    currentSat.setDate(thursday.getDate() - 5);
    const currentStart = toDateStr(currentSat);
    const currentEnd   = toDateStr(thursday);

    const prevThursday = new Date(thursday);
    prevThursday.setDate(thursday.getDate() - 7);
    const prevSat = new Date(currentSat);
    prevSat.setDate(currentSat.getDate() - 7);
    const prevStart = toDateStr(prevSat);
    const prevEnd   = toDateStr(prevThursday);

    const students = await Student.findAll({
      where: { isActive: true, dailyTarget: { [Op.lte]: 2 } },
      include: [{ model: Halaqa, as: 'halaqa', attributes: ['name'] }]
    });

    const studentIds = students.map(s => s._id);

    const trackings = await DailyTracking.findAll({
      where: {
        studentId: { [Op.in]: studentIds },
        date: { [Op.between]: [prevStart, currentEnd] }
      }
    });

    const trackingMap = {};
    trackings.forEach(t => {
      const sid = t.studentId;
      if (!trackingMap[sid]) trackingMap[sid] = [];
      trackingMap[sid].push(t);
    });

    const winners = [];

    students.forEach(student => {
      const recs = trackingMap[student._id] || [];
      let prevTotal    = 0;
      let currentTotal = 0;

      recs.forEach(t => {
        if ((t.attendance || 'present') === 'absent') return;
        const pages = Number(t.pagesMemorized || 0);
        const tDate = typeof t.date === 'string'
          ? t.date.slice(0, 10)
          : toDateStr(new Date(t.date));

        if (tDate >= prevStart && tDate <= prevEnd) {
          prevTotal += pages;
        } else if (tDate >= currentStart && tDate <= currentEnd) {
          currentTotal += pages;
        }
      });

      if (prevTotal >= 9 && currentTotal >= 14) {
        winners.push({
          _id:         student._id,
          name:        student.name,
          halaqaName:  student.halaqa?.name || '—',
          dailyTarget: student.dailyTarget,
          prevTotal,
          currentTotal,
          improvement: currentTotal - prevTotal,
          isRaised:    true
        });
      }
    });

    winners.sort((a, b) => b.improvement - a.improvement);

    res.json({
      success: true,
      data: {
        winners,
        ranges: {
          current: { start: currentStart, end: currentEnd },
          prev:    { start: prevStart,    end: prevEnd    }
        },
        thursday: toDateStr(thursday)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSurahPerformanceAwards = async (req, res) => {
  try {
    const students = await Student.findAll({
      where: { isActive: true },
      include: [{ model: Halaqa, as: 'halaqa', attributes: ['name'] }]
    });

    const studentIds = students.map(s => s._id);

    const trackings = await DailyTracking.findAll({
      where: {
        studentId: { [Op.in]: studentIds },
        isSurahCompleted: true
      },
      attributes: ['studentId', 'date', 'notes']
    });

    const normalizeAr = (str) =>
      (str || '')
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670ـ]/g, '')
        .trim();

    const matchesMap = {};
    trackings.forEach(t => {
      const normalizedNotes = normalizeAr(t.notes || '');
      const hasExcel = normalizedNotes.includes('ممتاز');
      const hasFirstTime = normalizedNotes.includes('وهل') || normalizedNotes.includes('اول') || normalizedNotes.includes('اول مره') || normalizedNotes.includes('اول مرة');

      if (hasExcel && hasFirstTime) {
        if (!matchesMap[t.studentId]) {
          matchesMap[t.studentId] = [];
        }
        matchesMap[t.studentId].push(t);
      }
    });

    const existingPrizes = await Prize.findAll({
      where: {
        studentId: { [Op.in]: studentIds },
        title: {
          [Op.or]: [
            { [Op.like]: '%الأداء في السورة%' },
            { [Op.like]: '%الاداء في السورة%' }
          ]
        }
      },
      attributes: ['studentId']
    });

    const prizeCounts = {};
    existingPrizes.forEach(p => {
      prizeCounts[p.studentId] = (prizeCounts[p.studentId] || 0) + 1;
    });

    const eligibleStudents = [];
    students.forEach(student => {
      const matches = matchesMap[student._id] || [];
      const N = matches.length;
      const P = prizeCounts[student._id] || 0;

      if (N >= 2) {
        const eligibleCount = Math.floor(N / 2);
        const pendingCount = eligibleCount - P;

        if (pendingCount > 0) {
          eligibleStudents.push({
            _id: student._id,
            name: student.name,
            halaqaName: student.halaqa?.name || '—',
            excellentSurahCount: N,
            awardsGivenCount: P,
            pendingAwardsCount: pendingCount,
            matchingRecords: matches.map(m => ({
              date: m.date,
              notes: m.notes
            }))
          });
        }
      }
    });

    res.json({
      success: true,
      data: eligibleStudents
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
  getImprovementAwards,
  getSurahPerformanceAwards
};
