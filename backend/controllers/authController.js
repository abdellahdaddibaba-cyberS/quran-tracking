const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const jwt = require('jsonwebtoken');
const { Expo } = require('expo-server-sdk');
const { Op } = require('sequelize');
const { syncPushTokenToSupabase } = require('../utils/syncPushTokens');

/**
 * توليد توكن JWT
 */
const { getJwtSecret } = require('../middleware/authMiddleware');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), { expiresIn: '30d' });
};

/**
 * تسجيل الدخول
 */
const login = async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    // البحث عن المستخدم
    const user = await User.findOne({ where: { username } });

    // التحقق من وجود المستخدم وكلمة المرور
    if (user && (await user.comparePassword(password))) {
      // تسجيل في السجل
      await LoginLog.create({
        username: username,
        status: 'success',
        ipAddress: ip,
        userAgent: userAgent
      });

      res.json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          token: generateToken(user._id)
        }
      });
    } else {
      // تسجيل محاولة فاشلة
      await LoginLog.create({
        username: username || 'unknown',
        status: 'failed',
        ipAddress: ip,
        userAgent: userAgent
      });

      res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب بيانات المستخدم الحالي (Profile)
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * تحديث بيانات المستخدم (Profile)
 */
const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (req.body.username) {
      user.username = req.body.username;
    }
    if (req.body.password) {
      if (!req.body.oldPassword) {
        return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور القديمة' });
      }
      const isMatch = await user.comparePassword(req.body.oldPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'كلمة المرور القديمة غير صحيحة' });
      }
      user.password = req.body.password;
    }
    if (req.body.fullName) {
      user.fullName = req.body.fullName;
    }

    await user.save();
    
    const { password, ...userWithoutPassword } = user.toJSON();
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * جلب سجلات تسجيل الدخول (للأدمن فقط)
 */
const getLoginLogs = async (req, res) => {
  try {
    const logs = await LoginLog.findAll({
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * حفظ رمز إشعارات الهاتف (Expo Push Token)
 */
const savePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    const user = await User.findByPk(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    if (!pushToken) {
      // Clear token locally and in Supabase
      user.pushToken = null;
      await user.save({ fields: ['pushToken'] });
      await syncPushTokenToSupabase(user._id, null);
      console.log(`🧹 pushToken cleared for parent ${user.fullName} (${user._id})`);
      return res.json({ success: true, message: 'تم إيقاف الإشعارات بنجاح' });
    }

    const trimmed = pushToken.trim();
    if (!Expo.isExpoPushToken(trimmed)) {
      return res.status(400).json({ success: false, message: 'رمز إشعارات إكسبو غير صالح' });
    }

    // Clear this token from any other users locally to ensure uniqueness
    await User.update(
      { pushToken: null },
      { where: { pushToken: trimmed, _id: { [Op.ne]: user._id } } }
    );

    user.pushToken = trimmed;
    await user.save({ fields: ['pushToken'] });

    await syncPushTokenToSupabase(user._id, trimmed);

    console.log(`✅ pushToken saved for parent ${user.fullName} (${user._id})`);
    res.json({ success: true, message: 'تم حفظ رمز الإشعارات بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, getMe, getLoginLogs, updateProfile, savePushToken };
