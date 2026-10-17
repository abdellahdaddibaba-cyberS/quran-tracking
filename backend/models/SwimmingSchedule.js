const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Student = require('./Student');

/**
 * نموذج جدول السباحة
 */
const SwimmingSchedule = sequelize.define('SwimmingSchedule', {
  _id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  studentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Student,
      key: '_id'
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  }
}, {
  timestamps: true,
  tableName: 'swimming_schedules',
  indexes: [
    {
      unique: true,
      fields: ['studentId', 'date']
    }
  ]
});

// العلاقات (Relationships)
SwimmingSchedule.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Student.hasMany(SwimmingSchedule, { foreignKey: 'studentId', as: 'swimmingSchedules' });

module.exports = SwimmingSchedule;
