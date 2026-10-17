const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * نموذج الحلقة القرآنية
 */
const Halaqa = sequelize.define('Halaqa', {
  _id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'اسم الحلقة مطلوب' }
    }
  },
  supervisor: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'اسم المشرف مطلوب' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  timestamps: true,
  tableName: 'halaqat'
});

module.exports = Halaqa;
