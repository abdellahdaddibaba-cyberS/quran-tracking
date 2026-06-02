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
    const Feedback = require('../models/Feedback');
    const User = require('../models/User');
    
    const feedbacks = await Feedback.findAll({
      order: [['createdAt', 'DESC']],
    });

    const userIds = [...new Set(feedbacks.map(f => f.userId))];
    const users = await User.findAll({
      where: { _id: userIds },
      attributes: ['_id', 'fullName', 'username', 'phoneNumber']
    });

    const userMap = new Map(users.map(u => [u._id, u]));

    const data = feedbacks.map(f => {
      const u = userMap.get(f.userId);
      return {
        ...f.toJSON(),
        user: u ? u.toJSON() : { fullName: 'مستخدم محذوف', username: '', phoneNumber: '' }
      };
    });

    res.json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getUsers, createUser, updateUser, deleteUser, getFeedbacks };
