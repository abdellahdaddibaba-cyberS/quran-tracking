const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * نموذج سجلات تغيير كلمة السر للأولياء
 */
const PasswordChangeLog = sequelize.define('PasswordChangeLog', {
  _id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
  },
  ipAddress: {
    type: DataTypes.STRING,
  },
  userAgent: {
    type: DataTypes.TEXT,
  },
  changedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  timestamps: true,
  tableName: 'password_change_logs'
});

module.exports = PasswordChangeLog;
