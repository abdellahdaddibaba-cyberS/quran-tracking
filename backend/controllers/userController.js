const User = require('../models/User');
const Student = require('../models/Student');
const { sequelize } = require('../config/db');

const ALLOWED_ROLES = ['admin', 'teacher', 'parent'];
const CREATE_FIELDS = ['username', 'password', 'fullName', 'role', 'phoneNumber', 'isActive'];
const UPDATE_FIELDS = ['username', 'password', 'fullName', 'role', 'phoneNumber', 'isActive'];

function pickFields(body, fields) {
  const result = {};
  for (const key of fields) {
    if (body[key] !== undefined) {
      result[key] = body[key];
    }
  }
  return result;
}

function validateRole(role) {
  if (role && !ALLOWED_ROLES.includes(role)) {
    throw new Error(`الدور غير صالح. الأدوار المسموحة: ${ALLOWED_ROLES.join(', ')}`);
  }
}

/**
 * جلب جميع المستخدمين (مع إمكانية الفلترة حسب الدور)
 */
const getUsers = async (req, res) => {
  try {
    const where = {};
    if (req.query.role) {
      if (!ALLOWED_ROLES.includes(req.query.role)) {
        return res.status(400).json({ success: false, message: 'دور غير صالح للفلترة' });
      }
      where.role = req.query.role;
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['fullName', 'ASC']],
    });

    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * إضافة مستخدم جديد
 */
const createUser = async (req, res) => {
  try {
    const payload = pickFields(req.body, CREATE_FIELDS);
    validateRole(payload.role);

    if (!payload.username || !payload.password || !payload.fullName) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم وكلمة المرور والاسم الكامل مطلوبة',
      });
    }

    const user = await User.create(payload);
    const { password, ...userWithoutPassword } = user.toJSON();
    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * تعديل مستخدم
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const payload = pickFields(req.body, UPDATE_FIELDS);
    validateRole(payload.role);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد حقول صالحة للتحديث' });
    }

    await user.update(payload);
    const { password, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * حذف مستخدم
 */
const deleteUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(req.params.id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    await Student.update(
      { parentId: null },
      { where: { parentId: req.params.id }, transaction }
    );

    await user.destroy({ transaction });
    await transaction.commit();
    res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب جميع الملاحظات والشكاوى (للأدمن)
 */
const getFeedbacks = async (req, res) => {
  try {
    let feedbacks = [];
    let users = [];

    if (process.env.SUPABASE_DB_URL) {
      const { Client } = require('pg');
      const supabaseClient = new Client({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });

      await supabaseClient.connect();
      try {
        const feedbackRes = await supabaseClient.query(
          `SELECT * FROM feedbacks ORDER BY "createdAt" DESC`
        );
        feedbacks = feedbackRes.rows;

        if (feedbacks.length > 0) {
          const userIds = [...new Set(feedbacks.map(f => f.userId))];
          const userRes = await supabaseClient.query(
            `SELECT _id, "fullName", username, "phoneNumber" FROM users WHERE _id = ANY($1)`,
            [userIds]
          );
          users = userRes.rows;
        }
      } finally {
        await supabaseClient.end().catch(() => {});
      }
    } else {
      const Feedback = require('../models/Feedback');
      const User = require('../models/User');
      
      const localFeedbacks = await Feedback.findAll({
        order: [['createdAt', 'DESC']],
      });
      feedbacks = localFeedbacks.map(f => f.toJSON());

      const userIds = [...new Set(feedbacks.map(f => f.userId))];
      const localUsers = await User.findAll({
        where: { _id: userIds },
        attributes: ['_id', 'fullName', 'username', 'phoneNumber']
      });
      users = localUsers.map(u => u.toJSON());
    }

    const userMap = new Map(users.map(u => [u._id, u]));

    const data = feedbacks.map(f => {
      const u = userMap.get(f.userId);
      return {
        ...f,
        user: u ? u : { fullName: 'مستخدم محذوف', username: '', phoneNumber: '' }
      };
    });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تقرير تتبع دخول أولياء الأمور اليومي للبوابة
 */
const getParentAccessReport = async (req, res) => {
  try {
    let parents = [];
    let students = [];
    let logs = [];

    if (process.env.SUPABASE_DB_URL) {
      const { Client } = require('pg');
      const supabaseClient = new Client({
        connectionString: process.env.SUPABASE_DB_URL,
        ssl: { rejectUnauthorized: false }
      });

      await supabaseClient.connect();
      try {
        // 1. Get parents
        const parentRes = await supabaseClient.query(
          `SELECT _id, "fullName", username, "phoneNumber", "isActive" FROM users WHERE role = 'parent' ORDER BY "fullName" ASC`
        );
        parents = parentRes.rows;

        if (parents.length > 0) {
          const parentIds = parents.map(p => p._id);
          const usernames = parents.map(p => p.username);

          // 2. Get students
          const studentRes = await supabaseClient.query(
            `SELECT _id, name, "parentId" FROM students WHERE "parentId" = ANY($1)`,
            [parentIds]
          );
          students = studentRes.rows;

          // 3. Get login logs (last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const logRes = await supabaseClient.query(
            `SELECT username, "loginTime" FROM login_logs WHERE username = ANY($1) AND status = 'success' AND "loginTime" >= $2 ORDER BY "loginTime" DESC`,
            [usernames, thirtyDaysAgo.toISOString()]
          );
          logs = logRes.rows;
        }
      } finally {
        await supabaseClient.end().catch(() => {});
      }
    } else {
      const User = require('../models/User');
      const Student = require('../models/Student');
      const LoginLog = require('../models/LoginLog');
      const { Op } = require('sequelize');

      const localParents = await User.findAll({
        where: { role: 'parent' },
        attributes: ['_id', 'fullName', 'username', 'phoneNumber', 'isActive'],
        order: [['fullName', 'ASC']]
      });
      parents = localParents.map(p => p.toJSON());

      if (parents.length > 0) {
        const parentIds = parents.map(p => p._id);
        const usernames = parents.map(p => p.username);

        const localStudents = await Student.findAll({
          where: { parentId: { [Op.in]: parentIds } },
          attributes: ['_id', 'name', 'parentId']
        });
        students = localStudents.map(s => s.toJSON());

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const localLogs = await LoginLog.findAll({
          where: {
            username: { [Op.in]: usernames },
            status: 'success',
            loginTime: { [Op.gte]: thirtyDaysAgo }
          },
          attributes: ['username', 'loginTime'],
          order: [['loginTime', 'DESC']]
        });
        logs = localLogs.map(l => l.toJSON());
      }
    }

    // Group students by parentId
    const studentsMap = new Map();
    students.forEach(s => {
      const pId = s.parentId;
      if (!studentsMap.has(pId)) {
        studentsMap.set(pId, []);
      }
      studentsMap.get(pId).push(s.name);
    });

    // Group login logs by username (case-insensitive and trimmed)
    const logsMap = new Map();
    logs.forEach(log => {
      const user = String(log.username || '').toLowerCase().trim();
      if (!logsMap.has(user)) {
        logsMap.set(user, []);
      }
      logsMap.get(user).push(log.loginTime);
    });

    const report = parents.map(p => {
      const parentKey = String(p.username || '').toLowerCase().trim();
      const parentLogins = logsMap.get(parentKey) || [];
      const parentStudents = studentsMap.get(p._id) || [];
      const lastLogin = parentLogins.length > 0 ? parentLogins[0] : null;

      return {
        _id: p._id,
        fullName: p.fullName,
        username: p.username,
        phoneNumber: p.phoneNumber,
        isActive: p.isActive,
        students: parentStudents,
        logins: parentLogins,
        lastLogin: lastLogin
      };
    });

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getFeedbacks, getParentAccessReport };
