const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Student = require('./Student');

/**
 * نموذج المتابعة اليومية
 */
const DailyTracking = sequelize.define('DailyTracking', {
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
    type: DataTypes.DATEONLY, // Date only without time for easier daily tracking
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  pagesRequired: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  pagesMemorized: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  attendance: {
    type: DataTypes.ENUM('present', 'absent', 'excused'),
    defaultValue: 'present'
  },
  individualSession: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isLate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isSurahCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  rewarded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
}, {
  timestamps: true,
  tableName: 'daily_trackings',
  indexes: [
    {
      unique: true,
      fields: ['studentId', 'date']
    }
  ]
});

// Relationships
DailyTracking.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Student.hasMany(DailyTracking, { foreignKey: 'studentId', as: 'trackings' });

module.exports = DailyTracking;
