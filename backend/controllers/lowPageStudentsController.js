const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const DailyTracking = require('../models/DailyTracking');
const Student = require('../models/Student');
const Halaqa = require('../models/Halaqa');

/**
 * جلب الطلبة الذين حصّلوا أقل من صفحتين لمدة يومين متتاليين أو أكثر
 * Query params:
 *   minDays  - عدد الأيام المتتالية (افتراضي: 2)
 *   threshold- عدد الصفحات الدنيا  (افتراضي: 2)
 */
const getLowPageStudents = async (req, res) => {
  try {
    const minDays  = parseInt(req.query.minDays)  || 2;
    const threshold = parseInt(req.query.threshold) || 2;

    // 1. جلب جميع السجلات التي pagesMemorized < threshold، مع بيانات الطالب
    const records = await DailyTracking.findAll({
      where: {
        pagesMemorized: { [Op.lt]: threshold },
        attendance: { [Op.ne]: 'absent' }, // لا نحسب الغائبين
      },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['_id', 'name', 'level'],
          where: { isActive: true },
          include: [{ model: Halaqa, as: 'halaqa', attributes: ['name', 'supervisor'] }],
        },
      ],
      order: [['studentId', 'ASC'], ['date', 'ASC']],
    });

    if (!records.length) {
      return res.json({ success: true, count: 0, data: [] });
    }

    // 2. تجميع السجلات حسب الطالب
    const byStudent = {};
    for (const rec of records) {
      const sid = rec.studentId;
      if (!byStudent[sid]) {
        byStudent[sid] = { student: rec.student, dates: [] };
      }
      byStudent[sid].dates.push(rec.date); // DATEONLY string 'YYYY-MM-DD'
    }

    // 3. إيجاد أطول سلسلة متتالية لكل طالب
    const result = [];

    for (const sid of Object.keys(byStudent)) {
      const { student, dates } = byStudent[sid];

      // ترتيب تصاعدي وتحويل لـ Date
      const sorted = dates
        .map(d => new Date(d))
        .sort((a, b) => a - b);

      let maxStreak = 1;
      let currentStreak = 1;
      let streakStart = sorted[0];
      let bestStart = sorted[0];
      let bestEnd = sorted[0];
      let currentEnd = sorted[0];

      for (let i = 1; i < sorted.length; i++) {
        const diffDays = (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          // يوم تالٍ مباشرة
          currentStreak++;
          currentEnd = sorted[i];
        } else {
          // انقطاع في التسلسل
          currentStreak = 1;
          streakStart = sorted[i];
          currentEnd = sorted[i];
        }
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          bestStart = streakStart;
          bestEnd = currentEnd;
        }
      }

      if (maxStreak >= minDays) {
        result.push({
          student: {
            _id: student._id,
            name: student.name,
            level: student.level,
            halaqa: student.halaqa,
          },
          maxConsecutiveDays: maxStreak,
          streakStart: bestStart.toISOString().split('T')[0],
          streakEnd:   bestEnd.toISOString().split('T')[0],
          totalLowDays: sorted.length,
        });
      }
    }

    // ترتيب حسب عدد الأيام المتتالية تنازلياً
    result.sort((a, b) => b.maxConsecutiveDays - a.maxConsecutiveDays);

    res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('getLowPageStudents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getLowPageStudents };
