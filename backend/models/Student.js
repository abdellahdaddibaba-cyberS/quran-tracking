const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Halaqa = require('./Halaqa');
const User = require('./User');

/**
 * نموذج الطالب
 */
const Student = sequelize.define('Student', {
  _id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'اسم الطالب مطلوب' }
    }
  },
  level: {
    type: DataTypes.ENUM('level1', 'level2', 'level3', 'level4'),
    defaultValue: 'level1'
  },
  startSurah: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'بداية السورة مطلوبة' }
    }
  },
  dailyTarget: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  halaqaId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Halaqa,
      key: '_id'
    }
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: User,
      key: '_id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: ''
  }
}, {
  timestamps: true,
  tableName: 'students'
});

// Relationships
Student.belongsTo(Halaqa, { foreignKey: 'halaqaId', as: 'halaqa' });
Halaqa.hasMany(Student, { foreignKey: 'halaqaId', as: 'students' });

const Prize = require('./Prize');

Student.belongsTo(User, { foreignKey: 'parentId', as: 'parent' });
User.hasMany(Student, { foreignKey: 'parentId', as: 'children' });

Student.hasMany(Prize, { foreignKey: 'studentId', as: 'prizes' });
Prize.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

module.exports = Student;
