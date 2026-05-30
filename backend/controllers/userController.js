const User = require('../models/User');
const Student = require('../models/Student');
const { sequelize } = require('../config/db');

/**
 * جلب جميع المستخدمين (مع إمكانية الفلترة حسب الدور)
 */
const getUsers = async (req, res) => {
  try {
    const where = {};
    if (req.query.role) {
      where.role = req.query.role;
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['fullName', 'ASC']]
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
    const user = await User.create(req.body);
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

    await user.update(req.body);
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
    
    // Set parentId to null for all students associated with this parent
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

module.exports = { getUsers, createUser, updateUser, deleteUser };
