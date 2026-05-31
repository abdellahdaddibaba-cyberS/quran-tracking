const Student = require('../models/Student');
const DailyTracking = require('../models/DailyTracking');

/**
 * اقتراح القسط اليومي (قواعد إحصائية على آخر 7 أيام — ليس نموذج LLM خارجي)
 */
const getSuggestion = async (req, res) => {
  try {
    const { studentId } = req.params;

    // جلب بيانات الطالب
    const student = await Student.findByPk(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    // جلب آخر 7 سجلات
    const lastRecords = await DailyTracking.findAll({
      where: { studentId },
      order: [['date', 'DESC']],
      limit: 7
    });

    if (lastRecords.length === 0) {
      return res.json({
        success: true,
        data: {
          studentName: student.name,
          currentTarget: student.dailyTarget,
          suggestedTarget: student.dailyTarget,
          successRate: null,
          totalDays: 0,
          successDays: 0,
          recommendation: 'لا توجد بيانات كافية لإجراء التقييم',
          status: 'no_data',
        },
      });
    }

    // حساب معدل النجاح
    const successDays = lastRecords.filter(
      (r) => r.pagesMemorized >= r.pagesRequired
    ).length;

    const totalDays = lastRecords.length;
    const successRate = successDays / totalDays;

    const currentTarget = student.dailyTarget;
    let suggestedTarget = currentTarget;
    let recommendation = '';
    let status = '';

    if (successRate >= 0.8) {
      suggestedTarget = currentTarget + 1;
      recommendation = `ممتاز! الطالب يُكمل قسطه باستمرار. يُقترح رفع القسط من ${currentTarget} إلى ${suggestedTarget} صفحة.`;
      status = 'increase';
    } else if (successRate < 0.5) {
      suggestedTarget = Math.max(1, currentTarget - 1);
      recommendation = `القسط الحالي مرتفع نسبياً. يُقترح تخفيض القسط من ${currentTarget} إلى ${suggestedTarget} صفحة.`;
      status = 'decrease';
    } else {
      recommendation = `الأداء مقبول. يُنصح بالإبقاء على القسط الحالي (${currentTarget} صفحة).`;
      status = 'keep';
    }

    res.json({
      success: true,
      data: {
        studentName: student.name,
        currentTarget,
        suggestedTarget,
        successRate: Math.round(successRate * 100), // كنسبة مئوية
        totalDays,
        successDays,
        recommendation,
        status, // increase | decrease | keep | no_data
        lastRecords: lastRecords.map((r) => ({
          date: r.date,
          required: r.pagesRequired,
          memorized: r.pagesMemorized,
          success: r.pagesMemorized >= r.pagesRequired,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestion };
