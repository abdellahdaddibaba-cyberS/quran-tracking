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

// ─── دالة مساعدة لاستخراج اسم الأب من اسم الطالب ──────────────────
const extractFatherName = (studentName) => {
  if (!studentName || !String(studentName).trim()) return '';
  const name = String(studentName).trim();

  // 1. التحقق مما إذا كان الاسم يحتوي على " بن " أو " ابن "
  const binRegex = /\s+(?:بن|ابن)\s+/i;
  if (binRegex.test(name)) {
    const parts = name.split(binRegex);
    if (parts.length > 1 && parts[1].trim()) {
      return parts.slice(1).join(' ').trim();
    }
  }

  // 2. تقسيم الاسم حسب المسافات
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    // التحقق مما إذا كان الاسم الأول مركباً (مثل "عبد الرحمن"، "أبو بكر"، "صلاح الدين")
    const isCompoundStart = parts[0] === 'عبد' || parts[0] === 'أبو' || parts[0] === 'ابو' || parts[0] === 'أم' || parts[0] === 'ام';
    const isCompoundEnd = parts[1] === 'الدين' || parts[1] === 'الله' || parts[1] === 'الاسلام' || parts[1] === 'الزهراء';

    if ((isCompoundStart || isCompoundEnd) && parts.length > 2) {
      return parts.slice(2).join(' ').trim();
    }
    // إرجاع بقية أجزاء الاسم بعد الاسم الأول
    return parts.slice(1).join(' ').trim();
  }

  return `والد ${name}`;
};

// ─── دالة مساعدة للبحث عن ولي الأمر أو إنشائه تلقائياً ───────────────
const getOrCreateParent = async (pName, pPhone, transaction) => {
  if (!pName || !String(pName).trim()) return null;

  const name = String(pName).trim();
  const phone = pPhone ? String(pPhone).trim() : '';

  const normalizeArabic = (str) => {
    if (!str) return '';
    return String(str)
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, '');
  };

  const normPhone = phone ? phone.trim().replace(/\s+/g, '') : '';
  const normName = normalizeArabic(name);

  // البحث في أولياء الأمور الحاليين لتجنب التكرار
  const existingParents = await User.findAll({
    where: { role: 'parent' },
    transaction
  });

  let matchedParent = null;
  if (normPhone) {
    matchedParent = existingParents.find(p => {
      const pPhoneNorm = p.phoneNumber ? p.phoneNumber.trim().replace(/\s+/g, '') : '';
      const pUsernameNorm = p.username ? p.username.trim().replace(/\s+/g, '') : '';
      return pPhoneNorm === normPhone || pUsernameNorm === normPhone;
    });
  }
  if (!matchedParent) {
    matchedParent = existingParents.find(p => p.fullName && normalizeArabic(p.fullName) === normName);
  }

  if (matchedParent) {
    // Update phone number if it wasn't set before
    if (phone && !matchedParent.phoneNumber) {
      await matchedParent.update({ phoneNumber: phone }, { transaction });
    }
    return { parent: matchedParent, isNew: false };
  }

  // توليد اسم مستخدم فريد من رقم الهاتف أو اسم الأب
  let username;
  if (phone) {
    username = phone.trim().replace(/\s+/g, '');
  } else {
    let baseUsername = name.replace(/\s+/g, '_');
    baseUsername = baseUsername.replace(/[^\u0600-\u06FFa-zA-Z0-9_]/g, '');
    if (!baseUsername) {
      baseUsername = 'parent';
    }
    username = baseUsername;
  }

  let finalUsername = username;
  let isUnique = false;
  let counter = 0;

  while (!isUnique) {
    const checkName = counter === 0 ? finalUsername : `${finalUsername}_${counter}`;
    const isTaken = await User.findOne({ where: { username: checkName }, transaction });
    if (!isTaken) {
      finalUsername = checkName;
      isUnique = true;
    } else {
      counter++;
    }
  }

  const newParent = await User.create({
    username: finalUsername,
    password: '123456', // كلمة المرور الافتراضية
    fullName: name,
    role: 'parent',
    phoneNumber: phone || null,
    isActive: true
  }, { transaction });

  return { parent: newParent, isNew: true };
};

// ─── إضافة طالب ───────────────────────────────────────────────────
const createStudent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const studentData = { ...req.body };
    if (!studentData.currentSurah && studentData.startSurah) {
      studentData.currentSurah = studentData.startSurah;
    }
    let parentCreated = null;

    // التحقق مما إذا كان قد تم تمرير اسم ولي الأمر لإنشائه تلقائياً أو استخراجه من اسم الطالب
    if (!studentData.parentId) {
      let pName = studentData.parentName ? String(studentData.parentName).trim() : '';
      if (!pName && studentData.name) {
        pName = extractFatherName(studentData.name);
      }
      if (pName) {
        const result = await getOrCreateParent(pName, studentData.parentPhone, transaction);
        if (result) {
          studentData.parentId = result.parent._id;
          if (result.isNew) {
            parentCreated = result.parent;
          }
        }
      }
    }

    const student = await Student.create(studentData, { transaction });
    await transaction.commit();

    const populated = await Student.findByPk(student._id, {
      include: [
        {
          model: Halaqa,
          as: 'halaqa',
          attributes: ['name', 'supervisor']
        },
        {
          model: User,
          as: 'parent',
          attributes: ['_id', 'fullName', 'username', 'phoneNumber']
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: populated,
      parentCreated: parentCreated ? {
        fullName: parentCreated.fullName,
        username: parentCreated.username
      } : null
    });
  } catch (error) {
    await transaction.rollback();
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

    const parentCache = [...existingParents];
    let parentsCreatedCount = 0;

    const normalizeArabic = (str) => {
      if (!str) return '';
      return String(str)
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, '');
    };

    const processedStudents = [];

    for (const studentData of students) {
      const student = { ...studentData };
      if (!student.currentSurah && student.startSurah) {
        student.currentSurah = student.startSurah;
      }
      let parentId = student.parentId;

      // إذا لم يكن لدى الطالب parentId، نحاول ربطه أو إنشائه تلقائياً من اسم الأب
      if (!parentId) {
        let pName = student.parentName ? String(student.parentName).trim() : '';
        if (!pName && student.name) {
          pName = extractFatherName(student.name);
        }

        if (pName) {
          const pPhone = student.parentPhone ? String(student.parentPhone).trim() : '';

          // 1. البحث في الكاش المحلي (الذي يضم أولياء الأمور الحاليين والجدد المنشئين في هذه الدفعة)
          let matchedParent = null;
          const normPhone = pPhone ? pPhone.trim().replace(/\s+/g, '') : '';
          const normName = normalizeArabic(pName);

          if (normPhone) {
            matchedParent = parentCache.find(p => {
              const pPhoneNorm = p.phoneNumber ? p.phoneNumber.trim().replace(/\s+/g, '') : '';
              const pUsernameNorm = p.username ? p.username.trim().replace(/\s+/g, '') : '';
              return pPhoneNorm === normPhone || pUsernameNorm === normPhone;
            });
          }
          if (!matchedParent) {
            matchedParent = parentCache.find(p => p.fullName && normalizeArabic(p.fullName) === normName);
          }

          if (matchedParent) {
            parentId = matchedParent._id;
            // Update phone number if it wasn't set before
            if (pPhone && !matchedParent.phoneNumber) {
              matchedParent.phoneNumber = pPhone;
              await matchedParent.save({ transaction });
            }
          } else {
            // 2. إذا لم نعثر عليه، نقوم بإنشاء ولي أمر جديد
            let username;
            if (pPhone) {
              username = pPhone.trim().replace(/\s+/g, '');
            } else {
              let baseUsername = pName.trim().replace(/\s+/g, '_');
              baseUsername = baseUsername.replace(/[^\u0600-\u06FFa-zA-Z0-9_]/g, '');
              if (!baseUsername) baseUsername = 'parent';
              username = baseUsername;
            }

            let finalUsername = username;
            let isUnique = false;
            let counter = 0;

            while (!isUnique) {
              const checkName = counter === 0 ? finalUsername : `${finalUsername}_${counter}`;
              const isTaken = parentCache.some(p => p.username === checkName) ||
                await User.findOne({ where: { username: checkName }, transaction });
              if (!isTaken) {
                finalUsername = checkName;
                isUnique = true;
              } else {
                counter++;
              }
            }

            const newParent = await User.create({
              username: finalUsername,
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

// ─── دالة مساعدة للتحقق من ختم القرآن الكريم وإرسال التهنئة ───────────
const checkAndSendQuranCompletionNotification = async (studentId, oldSurah, newSurah) => {
  try {
    if (!oldSurah || !newSurah) return;

    const normalizeAr = (str) =>
      String(str || '')
        .replace(/^سوره?\s+/, '')
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0670ـ]/g, '')
        .replace(/^ال/, '')
        .replace(/\s+/g, '')
        .trim();

    const normOld = normalizeAr(oldSurah);
    const normNew = normalizeAr(newSurah);

    // التحقق مما انتقل الحفظ من سورة البقرة إلى سورة الفاتحة (وهو ما يعني ختم القرآن في الترتيب العكسي)
    if (normOld === normalizeAr('البقرة') && normNew === normalizeAr('الفاتحة')) {
      const studentWithParent = await Student.findByPk(studentId, {
        include: [{
          model: User,
          as: 'parent',
          attributes: ['_id', 'pushToken', 'fullName']
        }]
      });

      if (studentWithParent && studentWithParent.parent && studentWithParent.parent.pushToken) {
        await syncPushTokensFromSupabase();

        // جلب ولي الأمر مجدداً للتأكد من استخدام التوكن الجديد المحدث بعد المزامنة
        const parentUser = await User.findByPk(studentWithParent.parent._id, {
          attributes: ['pushToken']
        });

        if (parentUser && parentUser.pushToken) {
          const title = `🎉 تهنئة ختم القرآن الكريم لـ ${studentWithParent.name}`;
          const body = `🎉 يسرنا ويسعدنا أن نهنئكم بختم ابنكم البار ${studentWithParent.name} للقرآن الكريم كاملاً (أتمَّ اليوم حفظ سورة البقرة). نسأل الله أن يجعله من أهل القرآن الذين هم أهل الله وخاصته، وأن يلبسكم تاج الوقار يوم القيامة. مبارك لكم ولوالده ولهذا الإنجاز العظيم! 📖✨`;

          await sendPushNotification([parentUser.pushToken], title, body, {
            studentId: studentWithParent._id,
            type: 'quran_completion',
            date: new Date().toISOString().split('T')[0]
          });
          console.log(`📲 تم إرسال إشعار تهنئة الختم لولي أمر الطالب: ${studentWithParent.name}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to send Quran completion notification:', error);
  }
};

// ─── تعديل طالب ───────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const student = await Student.findByPk(req.params.id, { transaction });
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
    }

    const oldSurah = student.currentSurah || student.startSurah;
    const studentData = { ...req.body };
    let parentCreated = null;

    // التحقق مما إذا كان قد تم تمرير اسم ولي الأمر لإنشائه تلقائياً أو استخراجه من اسم الطالب
    if (!studentData.parentId) {
      let pName = studentData.parentName ? String(studentData.parentName).trim() : '';
      if (!pName && studentData.name) {
        pName = extractFatherName(studentData.name);
      }
      if (pName) {
        const result = await getOrCreateParent(pName, studentData.parentPhone, transaction);
        if (result) {
          studentData.parentId = result.parent._id;
          if (result.isNew) {
            parentCreated = result.parent;
          }
        }
      }
    }

    await student.update(studentData, { transaction });
    await transaction.commit();

    const newSurah = studentData.currentSurah;
    if (newSurah) {
      checkAndSendQuranCompletionNotification(student._id, oldSurah, newSurah).catch(err => {
        console.error('Error in checkAndSendQuranCompletionNotification background execution:', err);
      });
    }

    const updated = await Student.findByPk(student._id, {
      include: [
        {
          model: Halaqa,
          as: 'halaqa',
          attributes: ['name', 'supervisor']
        },
        {
          model: User,
          as: 'parent',
          attributes: ['_id', 'fullName', 'username', 'phoneNumber']
        }
      ]
    });

    res.json({
      success: true,
      data: updated,
      parentCreated: parentCreated ? {
        fullName: parentCreated.fullName,
        username: parentCreated.username
      } : null
    });
  } catch (error) {
    await transaction.rollback();
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

    // التحقق مما إذا كان اليوم هو السبت وبدءاً من الأسبوع الأول (20 جوان 2026 فما فوق)
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const isSaturday = dateObj.getDay() === 6;
    const isFromWeekOne = date >= '2026-06-20';

    // إذا لم يكن هناك سجلات محفوظة مسبقاً (أو تم طلب auto=true) وكان التاريخ هو سبت بدءاً من الأسبوع الأول، نقوم بالتوليد التلقائي
    if ((schedules.length === 0 || auto === 'true') && isSaturday && isFromWeekOne) {
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

        const targetMultiplier = date === '2026-06-20' ? 5 : 6;
        const targetScore = Number(student.dailyTarget || 1) * targetMultiplier;
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
