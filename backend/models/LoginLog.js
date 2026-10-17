const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * نموذج سجلات تسجيل الدخول
 */
const LoginLog = sequelize.define('LoginLog', {
  _id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING, // success, failed
    allowNull: false,
  },
  ipAddress: {
    type: DataTypes.STRING,
  },
  userAgent: {
    type: DataTypes.TEXT,
  },
  loginTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  timestamps: true,
  tableName: 'login_logs'
});

module.exports = LoginLog;
