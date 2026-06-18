const Student = require('../models/Student');
const DailyTracking = require('../models/DailyTracking');
const Halaqa = require('../models/Halaqa');
const { isLlmConfigured, getLlmSuggestion } = require('../utils/llm');

const LEVEL_LABELS = {
  level1: 'المستوى الأول',
  level2: 'المستوى الثاني',
  level3: 'المستوى الثالث',
  level4: 'المستوى الرابع',
};

function buildLastRecordsPayload(records) {
  return records.map((r) => ({
    date: r.date,
    required: r.pagesRequired,
    memorized: r.pagesMemorized,
    attendance: r.attendance,
    isLate: r.isLate,
    isSurahCompleted: r.isSurahCompleted,
    success: r.pagesMemorized >= r.pagesRequired,
  }));
}

function computeStats(student, lastRecords) {
  const successDays = lastRecords.filter((r) => r.pagesMemorized >= r.pagesRequired).length;
  const totalDays = lastRecords.length;
  const successRate = totalDays > 0 ? Math.round((successDays / totalDays) * 100) : null;
  const currentTarget = student.dailyTarget;

  let suggestedTarget = currentTarget;
  let recommendation = '';
  let status = 'keep';

  if (totalDays === 0) {
    return {
      currentTarget,
      suggestedTarget: currentTarget,
      successRate: null,
      totalDays: 0,
      successDays: 0,
      recommendation: 'لا توجد بيانات كافية لإجراء التقييم',
      status: 'no_data',
    };
  }

  const rate = successDays / totalDays;

  if (rate >= 0.8) {
    suggestedTarget = Math.min(10, currentTarget + 1);
    recommendation = `ممتاز! الطالب يُكمل قسطه باستمرار. يُقترح رفع القسط من ${currentTarget} إلى ${suggestedTarget} صفحة.`;
    status = 'increase';
  } else if (rate < 0.5) {
    suggestedTarget = Math.max(1, currentTarget - 1);
    recommendation = `القسط الحالي مرتفع نسبياً. يُقترح تخفيض القسط من ${currentTarget} إلى ${suggestedTarget} صفحة.`;
    status = 'decrease';
  } else {
    recommendation = `الأداء مقبول. يُنصح بالإبقاء على القسط الحالي (${currentTarget} صفحة).`;
    status = 'keep';
  }

  return {
    currentTarget,
    suggestedTarget,
    successRate,
    totalDays,
    successDays,
    recommendation,
    status,
  };
}

function normalizeLlmResult(llmResult, stats) {
  const parsedTarget = Number.parseInt(llmResult.suggestedTarget, 10);
  const suggestedTarget = Number.isFinite(parsedTarget)
    ? Math.min(10, Math.max(1, parsedTarget))
    : stats.suggestedTarget;

  const allowedStatus = ['increase', 'decrease', 'keep', 'no_data'];
  const status = allowedStatus.includes(llmResult.status) ? llmResult.status : stats.status;

  const recommendation =
    typeof llmResult.recommendation === 'string' && llmResult.recommendation.trim()
      ? llmResult.recommendation.trim()
      : stats.recommendation;

  return { suggestedTarget, status, recommendation };
}

function buildLlmContext(student, halaqa, lastRecords, stats) {
  const absentDays = lastRecords.filter((r) => r.attendance === 'absent').length;
  const excusedDays = lastRecords.filter((r) => r.attendance === 'excused').length;
  const lateDays = lastRecords.filter((r) => r.isLate).length;
  const surahCompletedDays = lastRecords.filter((r) => r.isSurahCompleted).length;
  const avgMemorized =
    lastRecords.length > 0
      ? Number(
          (
            lastRecords.reduce((sum, r) => sum + r.pagesMemorized, 0) / lastRecords.length
          ).toFixed(2)
        )
      : 0;

  return {
    student: {
      name: student.name,
      level: LEVEL_LABELS[student.level] || student.level,
      startSurah: student.startSurah,
      currentSurah: student.currentSurah || student.startSurah,
      currentDailyTarget: student.dailyTarget,
      notes: student.notes || '',
    },
    halaqa: halaqa ? { name: halaqa.name, supervisor: halaqa.supervisor } : null,
    analysisWindowDays: lastRecords.length,
    metrics: {
      successRatePercent: stats.successRate,
      successDays: stats.successDays,
      totalDays: stats.totalDays,
      absentDays,
      excusedDays,
      lateDays,
      surahCompletedDays,
      averagePagesMemorized: avgMemorized,
    },
    recentRecords: buildLastRecordsPayload(lastRecords),
  };
}

/**
 * اقتراح القسط اليومي باستخدام LLM مع fallback إحصائي
 */
const getSuggestion = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findByPk(studentId, {
      include: [{ model: Halaqa, as: 'halaqa', attributes: ['name', 'supervisor'] }],
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    const lastRecords = await DailyTracking.findAll({
      where: { studentId },
      order: [['date', 'DESC']],
      limit: 14,
    });

    const stats = computeStats(student, lastRecords);
    const lastRecordsPayload = buildLastRecordsPayload(lastRecords);

    if (stats.status === 'no_data') {
      return res.json({
        success: true,
        data: {
          studentName: student.name,
          ...stats,
          lastRecords: lastRecordsPayload,
          source: 'no_data',
        },
      });
    }

    let finalResult = { ...stats };
    let source = 'fallback';

    if (isLlmConfigured()) {
      try {
        const context = buildLlmContext(student, student.halaqa, lastRecords, stats);
        const llmResult = await getLlmSuggestion(context);
        finalResult = {
          ...stats,
          ...normalizeLlmResult(llmResult, stats),
        };
        source = 'llm';
      } catch (llmError) {
        console.error('LLM suggestion failed, using statistical fallback:', llmError.message);
        source = 'fallback';
      }
    } else {
      console.warn('LLM not configured (set OPENAI_API_KEY or GEMINI_API_KEY) — using statistical fallback');
    }

    res.json({
      success: true,
      data: {
        studentName: student.name,
        currentTarget: finalResult.currentTarget,
        suggestedTarget: finalResult.suggestedTarget,
        successRate: finalResult.successRate,
        totalDays: finalResult.totalDays,
        successDays: finalResult.successDays,
        recommendation: finalResult.recommendation,
        status: finalResult.status,
        lastRecords: lastRecordsPayload,
        source,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestion };
