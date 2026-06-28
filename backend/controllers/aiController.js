const Student = require('../models/Student');
const DailyTracking = require('../models/DailyTracking');
const Halaqa = require('../models/Halaqa');
const { isLlmConfigured, getLlmSuggestion, getLlmHalaqaSuggestion } = require('../utils/llm');

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

/**
 * اقتراح القسط اليومي لحلقة كاملة (LLM مع fallback إحصائي)
 */
const getHalaqaSuggestion = async (req, res) => {
  try {
    const { halaqaId } = req.params;

    const halaqa = await Halaqa.findByPk(halaqaId);
    if (!halaqa) {
      return res.status(404).json({ success: false, message: 'الحلقة غير موجودة' });
    }

    const students = await Student.findAll({
      where: { halaqaId, isActive: true },
      order: [['name', 'ASC']],
    });

    if (students.length === 0) {
      return res.json({
        success: true,
        data: {
          halaqaName: halaqa.name,
          overallEvaluation: 'لا يوجد طلاب نشطين في هذه الحلقة لإجراء التقييم.',
          students: [],
          statsSummary: {
            totalStudents: 0,
            analyzedStudents: 0,
            avgSuccessRate: null,
            increaseCount: 0,
            decreaseCount: 0,
            keepCount: 0,
            noDataCount: 0,
          }
        }
      });
    }

    // 1. جلب سجلات التتبع وحساب الإحصائيات الفردية لكل طالب
    const studentsAnalyses = [];
    let totalSuccessRateSum = 0;
    let successRateCount = 0;
    let increaseCount = 0;
    let decreaseCount = 0;
    let keepCount = 0;
    let noDataCount = 0;

    for (const student of students) {
      const lastRecords = await DailyTracking.findAll({
        where: { studentId: student._id },
        order: [['date', 'DESC']],
        limit: 14,
      });

      const stats = computeStats(student, lastRecords);
      const lastRecordsPayload = buildLastRecordsPayload(lastRecords);

      if (stats.successRate !== null) {
        totalSuccessRateSum += stats.successRate;
        successRateCount++;
      }

      if (stats.status === 'increase') increaseCount++;
      else if (stats.status === 'decrease') decreaseCount++;
      else if (stats.status === 'keep') keepCount++;
      else if (stats.status === 'no_data') noDataCount++;

      studentsAnalyses.push({
        studentId: student._id,
        studentName: student.name,
        level: LEVEL_LABELS[student.level] || student.level,
        currentTarget: stats.currentTarget,
        suggestedTarget: stats.suggestedTarget,
        successRate: stats.successRate,
        totalDays: stats.totalDays,
        successDays: stats.successDays,
        status: stats.status,
        recommendation: stats.recommendation,
        lastRecords: lastRecordsPayload,
      });
    }

    const avgSuccessRate = successRateCount > 0 ? Math.round(totalSuccessRateSum / successRateCount) : null;

    let overallEvaluation = '';
    let source = 'fallback';

    // 2. محاولة استخدام LLM للتقييم الجماعي والفردي
    if (isLlmConfigured()) {
      try {
        // بناء السياق للـ LLM
        const context = {
          halaqa: {
            name: halaqa.name,
            supervisor: halaqa.supervisor,
            description: halaqa.description || '',
          },
          metrics: {
            totalStudents: students.length,
            analyzedStudents: successRateCount,
            avgSuccessRatePercent: avgSuccessRate,
            increaseCount,
            decreaseCount,
            keepCount,
            noDataCount,
          },
          students: studentsAnalyses.map(sa => ({
            studentId: sa.studentId,
            name: sa.studentName,
            level: sa.level,
            currentTarget: sa.currentTarget,
            successRatePercent: sa.successRate,
            status: sa.status,
            totalDays: sa.totalDays,
            successDays: sa.successDays,
          }))
        };

        const llmResult = await getLlmHalaqaSuggestion(context);
        
        if (llmResult && llmResult.overallEvaluation) {
          overallEvaluation = llmResult.overallEvaluation;
          source = 'llm';

          // تحديث التوصيات الفردية للطلاب بناءً على رد الـ LLM
          if (Array.isArray(llmResult.students)) {
            for (const sa of studentsAnalyses) {
              const studentLlm = llmResult.students.find(s => Number(s.studentId) === Number(sa.studentId));
              if (studentLlm) {
                // معالجة القسط المقترح للتأكد من أنه عدد صالح ومحدود
                const parsedTarget = Number.parseFloat(studentLlm.suggestedTarget);
                const suggestedTarget = Number.isFinite(parsedTarget)
                  ? Math.min(10, Math.max(0.5, parsedTarget))
                  : sa.suggestedTarget;

                const allowedStatus = ['increase', 'decrease', 'keep', 'no_data'];
                const status = allowedStatus.includes(studentLlm.status) ? studentLlm.status : sa.status;

                const recommendation = typeof studentLlm.recommendation === 'string' && studentLlm.recommendation.trim()
                  ? studentLlm.recommendation.trim()
                  : sa.recommendation;

                sa.suggestedTarget = suggestedTarget;
                sa.status = status;
                sa.recommendation = recommendation;
              }
            }
          }
        }
      } catch (llmError) {
        console.error('LLM Halaqa suggestion failed, using statistical fallback:', llmError.message);
        source = 'fallback';
      }
    }

    // 3. التقييم الجماعي الافتراضي في حال عدم تفعيل الـ LLM أو فشله
    if (!overallEvaluation) {
      const parts = [
        `تقرير الأداء لحلقة "${halaqa.name}" (بإشراف المعلم: ${halaqa.supervisor || 'غير محدد'}).`,
        `نسبة الإنجاز العامة للحلقة تبلغ ${avgSuccessRate !== null ? `${avgSuccessRate}%` : 'غير متوفرة'}.`
      ];

      if (students.length > 0) {
        parts.push(
          `من بين ${students.length} طلاب تم تحليل أدائهم:`,
          `- يُقترح رفع القسط لـ ${increaseCount} طلاب لتحسن مستواهم.`,
          `- يُقترح تخفيض القسط لـ ${decreaseCount} طلاب لتيسير المراجعة والحفظ.`,
          `- يُنصح بالإبقاء على الأقساط الحالية لـ ${keepCount} طلاب.`
        );
        if (noDataCount > 0) {
          parts.push(`- هناك ${noDataCount} طلاب لا توجد لديهم بيانات كافية للتحليل.`);
        }
      }
      overallEvaluation = parts.join(' ');
    }

    // إعادة فرز إحصائيات الحالة بناءً على التعديلات النهائية
    let finalIncreaseCount = 0;
    let finalDecreaseCount = 0;
    let finalKeepCount = 0;
    let finalNoDataCount = 0;
    for (const sa of studentsAnalyses) {
      if (sa.status === 'increase') finalIncreaseCount++;
      else if (sa.status === 'decrease') finalDecreaseCount++;
      else if (sa.status === 'keep') finalKeepCount++;
      else if (sa.status === 'no_data') finalNoDataCount++;
    }

    res.json({
      success: true,
      data: {
        halaqaName: halaqa.name,
        overallEvaluation,
        students: studentsAnalyses,
        statsSummary: {
          totalStudents: students.length,
          analyzedStudents: successRateCount,
          avgSuccessRate,
          increaseCount: finalIncreaseCount,
          decreaseCount: finalDecreaseCount,
          keepCount: finalKeepCount,
          noDataCount: finalNoDataCount,
        },
        source,
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestion, getHalaqaSuggestion };
